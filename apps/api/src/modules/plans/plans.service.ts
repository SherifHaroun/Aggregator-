import type { CustomerType, Prisma } from '@prisma/client';
import { derivePlanCode, type Paginated, type PlanDto } from '@aggregator/shared';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
import { planOptionInclude } from '../plan-options/plan-options.mapper.js';
import { assertNetworkBelongsToCompany } from '../companies/medical-networks.service.js';
import { toPlanDto } from './plans.mapper.js';
import type { CreatePlanInput, DuplicatePlanInput, UpdatePlanInput } from './plans.schemas.js';

/**
 * A plan together with every configuration, and each configuration's options,
 * field definitions and values — the whole product in one response.
 */
const planDetailInclude = {
  configurations: {
    include: {
      options: { include: planOptionInclude, orderBy: { sortOrder: 'asc' as const } },
      /** So each variant names its network without a second request. */
      medicalNetwork: true,
      plan: { select: { name: true } },
      /** The rate table, youngest band first, as a plan document writes it. */
      priceBands: { orderBy: { ageFrom: 'asc' as const } },
    },
    /**
     * By coverage area, which is what separates one variant of a plan from
     * another. Age no longer belongs here: it separates the price bands INSIDE
     * a variant, and they carry their own order.
     */
    orderBy: [{ geographicalCoverage: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

export async function listPlans(
  query: ListQuery & { companyId?: string; insuranceTypeId?: string },
): Promise<Paginated<PlanDto>> {
  const prisma = getPrisma();
  const where = {
    ...activeFilter(query.isActive),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.insuranceTypeId ? { insuranceTypeId: query.insuranceTypeId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { code: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.plan.findMany({ where, orderBy: { name: 'asc' }, ...toSkipTake(query) }),
    prisma.plan.count({ where }),
  ]);

  return paginate(items.map(toPlanDto), total, query);
}

/** A single plan with all its configurations and their options. */
export async function getPlan(id: string): Promise<PlanDto> {
  const plan = await getPrisma().plan.findUnique({ where: { id }, include: planDetailInclude });
  if (!plan) throw notFound('Plan');
  return toPlanDto(plan);
}

/**
 * Copy a plan — the product, and whichever of its configurations the employee
 * picked.
 *
 * A company's plans are usually one product priced several ways: the same
 * benefits, the same age bands, different premiums. Entering the second tier
 * from scratch means re-typing thirty benefits ten times over, so a copy takes
 * the lot — every selected configuration with its options, their values and
 * their notes — and leaves the employee changing the figures that actually
 * differ.
 *
 * THE NAME MUST CHANGE. A copy that keeps the source's name is refused, because
 * two identically-named plans in one company is how the wrong one gets quoted.
 *
 * The copy is independent the moment it exists: it owns its own configurations,
 * option rows and values, so editing it never touches the plan it came from.
 */
export async function duplicatePlan(id: string, input: DuplicatePlanInput): Promise<PlanDto> {
  const prisma = getPrisma();

  const source = await prisma.plan.findUnique({
    where: { id },
    include: {
      configurations: {
        include: {
          options: { include: { values: true, selectedChoices: true } },
          priceBands: { orderBy: { ageFrom: 'asc' } },
        },
      },
    },
  });
  if (!source) throw notFound('Plan');

  if (input.name.trim().toLowerCase() === source.name.trim().toLowerCase()) {
    throw badRequest('Give the copy a different name from the plan it is copied from.', {
      name: ['This is the name of the plan being copied. Enter a different one.'],
    });
  }

  // A copy is sold to the same buyer, so its code carries the same suffix.
  const code = input.code ?? derivePlanCode(input.name, source.customerType);
  if (code === '') {
    throw badRequest('The plan code could not be derived from this name. Enter one.', {
      code: ['Enter a plan code.'],
    });
  }

  const clash = await prisma.plan.findFirst({
    where: { companyId: source.companyId, code },
    select: { name: true },
  });
  if (clash) {
    throw conflict(
      `This company already has a plan with the code "${code}" ("${clash.name}"). Enter a different code.`,
    );
  }

  /**
   * What to bring across. Omitted means all of it; anything named must belong
   * to the plan being copied, or the employee is copying something they cannot
   * see.
   */
  const wanted =
    input.configurationIds === undefined
      ? source.configurations
      : source.configurations.filter((configuration) =>
          input.configurationIds!.includes(configuration.id),
        );

  if (input.configurationIds && wanted.length !== input.configurationIds.length) {
    throw badRequest('The selection contains configurations that do not belong to this plan.');
  }

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        companyId: source.companyId,
        /**
         * A copy is sold to the same buyer. Individual, Family and SME are
         * separate products, so a copy that quietly changed this would file the
         * plan in a section the employee was not looking at.
         */
        customerType: source.customerType,
        name: input.name,
        code,
        description: input.description === undefined ? source.description : input.description,
        isActive: input.isActive ?? source.isActive,
      },
      select: { id: true },
    });

    if (wanted.length === 0) return plan;

    /**
     * Three statements for the whole copy, whatever its size: the
     * configurations, then their attachments, then the values. A statement per
     * row would spend longer than the transaction is allowed to live on exactly
     * the plans worth copying — ten age bands of thirty benefits is 300 rows.
     */
    const configurations = await tx.planConfiguration.createManyAndReturn({
      data: wanted.map((configuration) => ({
        planId: plan.id,
        geographicalCoverage: configuration.geographicalCoverage,
        // The network and room are part of what a variant IS, so a copy that
        // dropped them would be a different offering wearing the same name.
        medicalNetworkId: configuration.medicalNetworkId,
        roomType: configuration.roomType,
        currency: configuration.currency,
        annualLimit: configuration.annualLimit,
        deductible: configuration.deductible,
        coPayment: configuration.coPayment,
        isActive: configuration.isActive,
      })),
      select: {
        id: true,
        geographicalCoverage: true,
        medicalNetworkId: true,
        roomType: true,
        annualLimit: true,
      },
    });

    /** A variant is unique on exactly these within a plan, so this is exact. */
    const identity = (configuration: {
      geographicalCoverage: string;
      medicalNetworkId: string | null;
      roomType: string | null;
      annualLimit: Prisma.Decimal | null;
    }) =>
      [
        configuration.geographicalCoverage,
        configuration.medicalNetworkId ?? '',
        configuration.roomType ?? '',
        configuration.annualLimit === null ? '' : configuration.annualLimit.toString(),
      ].join('|');

    const newConfigurationId = new Map(
      configurations.map((configuration) => [identity(configuration), configuration.id]),
    );

    /**
     * The rate table comes across whole. It is the cheapest part of the copy —
     * one row per band, no values hanging off it — and a copy priced at nothing
     * would read as a plan nobody sells.
     */
    const bands = wanted.flatMap((configuration) => {
      const variantId = newConfigurationId.get(identity(configuration));
      if (!variantId) return [];
      return configuration.priceBands.map((band) => ({
        variantId,
        ageFrom: band.ageFrom,
        ageTo: band.ageTo,
        annualPrice: band.annualPrice,
      }));
    });
    if (bands.length > 0) await tx.planPriceBand.createMany({ data: bands });

    const attachments = wanted.flatMap((configuration) => {
      const planConfigurationId = newConfigurationId.get(identity(configuration));
      if (!planConfigurationId) return [];
      return configuration.options.map((planOption) => ({
        planConfigurationId,
        optionId: planOption.optionId,
        sortOrder: planOption.sortOrder,
        note: planOption.note,
      }));
    });

    if (attachments.length === 0) return plan;

    const planOptions = await tx.planOption.createManyAndReturn({
      data: attachments,
      select: { id: true, planConfigurationId: true, optionId: true },
    });

    const newPlanOptionId = new Map(
      planOptions.map((row) => [`${row.planConfigurationId}|${row.optionId}`, row.id]),
    );

    const values = wanted.flatMap((configuration) => {
      const planConfigurationId = newConfigurationId.get(identity(configuration));
      if (!planConfigurationId) return [];
      return configuration.options.flatMap((planOption) => {
        const planOptionId = newPlanOptionId.get(`${planConfigurationId}|${planOption.optionId}`);
        if (!planOptionId) return [];
        return planOption.values.map((value) => ({
          planOptionId,
          optionFieldId: value.optionFieldId,
          numberValue: value.numberValue,
          textValue: value.textValue,
          booleanValue: value.booleanValue,
        }));
      });
    });

    if (values.length > 0) await tx.planOptionValue.createMany({ data: values });

    /**
     * The ticked answers travel with the figures they qualify, for the same
     * reason the notes do: "800 EGP" without "basic procedures only" is
     * different, better-looking cover than the plan being copied.
     */
    const ticked = wanted.flatMap((configuration) => {
      const planConfigurationId = newConfigurationId.get(identity(configuration));
      if (!planConfigurationId) return [];
      return configuration.options.flatMap((planOption) => {
        const planOptionId = newPlanOptionId.get(`${planConfigurationId}|${planOption.optionId}`);
        if (!planOptionId) return [];
        return planOption.selectedChoices.map((row) => ({
          planOptionId,
          optionFieldId: row.optionFieldId,
          choiceId: row.choiceId,
        }));
      });
    });

    if (ticked.length > 0) await tx.planOptionValueChoice.createMany({ data: ticked });

    return plan;
  });

  return getPlan(created.id);
}

export async function createPlan(input: CreatePlanInput): Promise<PlanDto> {
  const prisma = getPrisma();

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true },
  });
  if (!company) throw notFound('Company');

  await assertPlanIsDistinct(input.companyId, input.customerType, input.name);

  const plan = await prisma.plan.create({ data: input, include: planDetailInclude });
  return toPlanDto(plan);
}

/**
 * Refuse a plan that repeats one this company already sells to the same buyer.
 *
 * The unique index covers the CODE, which is enough for the codes this
 * application derives. It is not enough for a code an employee typed: two
 * plans both named "Platinum" for individuals, coded PLAT and PLATINUM, would
 * both be accepted and neither would be tellable from the other on screen.
 *
 * Scoped to one customer type on purpose. "Platinum" for individuals and
 * "Platinum" for families are DIFFERENT products, and refusing the second is
 * the fault this whole change exists to fix.
 */
async function assertPlanIsDistinct(
  companyId: string,
  customerType: CustomerType,
  name: string,
  { excludeId }: { excludeId?: string } = {},
): Promise<void> {
  const twin = await getPrisma().plan.findFirst({
    where: {
      companyId,
      customerType,
      // Names compare case-insensitively, as the catalogue's own rule does.
      name: { equals: name.trim(), mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (twin) {
    throw conflict(
      `This company already sells a plan called "${name.trim()}" to ${customerType.toLowerCase()} customers. Edit that one, or give this a different name.`,
    );
  }
}

/**
 * Edit the plan itself — its name, code, status and the buyer it is sold to.
 *
 * How good the plan is does not appear here. Basic, Standard and Premium are
 * read off each variant's annual limit rather than filed by hand, so raising a
 * ceiling changes the tier and nothing has to be remembered.
 */
export async function updatePlan(id: string, input: UpdatePlanInput): Promise<PlanDto> {
  const prisma = getPrisma();

  /**
   * Renaming, or moving a plan to another buyer, can collide with a plan that
   * is already there. Checked against where the plan is ABOUT to be, not where
   * it is now.
   */
  if (input.name !== undefined || input.customerType !== undefined) {
    const current = await prisma.plan.findUnique({
      where: { id },
      select: { companyId: true, customerType: true, name: true },
    });
    if (!current) throw notFound('Plan');
    await assertPlanIsDistinct(
      current.companyId,
      input.customerType ?? current.customerType,
      input.name ?? current.name,
      { excludeId: id },
    );
  }

  const plan = await prisma.plan.update({
    where: { id },
    data: input,
    include: planDetailInclude,
  });
  return toPlanDto(plan);
}

/**
 * Permanent delete. A plan owns its configurations, which own their option
 * assignments and values, so the whole tree cascades. Deactivate instead when
 * the plan has been quoted or compared.
 */
export async function deletePlan(id: string): Promise<void> {
  await getPrisma().plan.delete({ where: { id } });
}
