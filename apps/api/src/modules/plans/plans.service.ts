import { derivePlanCode, type Paginated, type PlanDto } from '@aggregator/shared';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
import { planOptionInclude } from '../plan-options/plan-options.mapper.js';
import { toPlanDto } from './plans.mapper.js';
import type { CreatePlanInput, DuplicatePlanInput, UpdatePlanInput } from './plans.schemas.js';

/**
 * A plan together with every configuration, and each configuration's options,
 * field definitions and values — the whole product in one response.
 */
const planDetailInclude = {
  configurations: {
    include: { options: { include: planOptionInclude, orderBy: { sortOrder: 'asc' as const } } },
    /**
     * Youngest band first within each customer type and coverage area — the
     * order the premium table in a plan document reads, and the order every
     * screen showing these configurations wants.
     */
    orderBy: [
      { customerType: 'asc' as const },
      { geographicalCoverage: 'asc' as const },
      { ageFrom: 'asc' as const },
      { ageTo: 'asc' as const },
    ],
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
      configurations: { include: { options: { include: { values: true } } } },
    },
  });
  if (!source) throw notFound('Plan');

  if (input.name.trim().toLowerCase() === source.name.trim().toLowerCase()) {
    throw badRequest('Give the copy a different name from the plan it is copied from.', {
      name: ['This is the name of the plan being copied. Enter a different one.'],
    });
  }

  const code = input.code ?? derivePlanCode(input.name);
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
        insuranceTypeId: source.insuranceTypeId,
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
        customerType: configuration.customerType,
        geographicalCoverage: configuration.geographicalCoverage,
        ageFrom: configuration.ageFrom,
        ageTo: configuration.ageTo,
        currency: configuration.currency,
        annualPrice: configuration.annualPrice,
        annualLimit: configuration.annualLimit,
        deductible: configuration.deductible,
        coPayment: configuration.coPayment,
        isActive: configuration.isActive,
      })),
      select: {
        id: true,
        customerType: true,
        geographicalCoverage: true,
        ageFrom: true,
        ageTo: true,
      },
    });

    /** A configuration is unique on these four within a plan, so this is exact. */
    const identity = (configuration: {
      customerType: string;
      geographicalCoverage: string;
      ageFrom: number;
      ageTo: number;
    }) =>
      `${configuration.customerType}|${configuration.geographicalCoverage}|${configuration.ageFrom}|${configuration.ageTo}`;

    const newConfigurationId = new Map(
      configurations.map((configuration) => [identity(configuration), configuration.id]),
    );

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

    return plan;
  });

  return getPlan(created.id);
}

export async function createPlan(input: CreatePlanInput): Promise<PlanDto> {
  const prisma = getPrisma();

  const [company, insuranceType] = await Promise.all([
    prisma.company.findUnique({ where: { id: input.companyId }, select: { id: true } }),
    prisma.insuranceType.findUnique({ where: { id: input.insuranceTypeId }, select: { id: true } }),
  ]);
  if (!company) throw notFound('Company');
  if (!insuranceType) throw notFound('Insurance type');

  const plan = await prisma.plan.create({ data: input, include: planDetailInclude });
  return toPlanDto(plan);
}

/**
 * Edit the plan itself — its name, code, status, and the insurance type it is
 * filed under.
 *
 * Refiling a plan carries nothing with it and breaks nothing: benefits are
 * global, so the configurations and their values are untouched. Only which
 * comparison the plan answers changes.
 */
export async function updatePlan(id: string, input: UpdatePlanInput): Promise<PlanDto> {
  const prisma = getPrisma();

  if (input.insuranceTypeId !== undefined) {
    const insuranceType = await prisma.insuranceType.findUnique({
      where: { id: input.insuranceTypeId },
      select: { id: true },
    });
    if (!insuranceType) throw notFound('Insurance type');
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
