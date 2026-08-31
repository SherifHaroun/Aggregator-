import type { Paginated, PlanConfigurationDto } from '@aggregator/shared';
import { conflict, notFound } from '../../lib/errors.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
import { assertNetworkBelongsToCompany } from '../companies/medical-networks.service.js';
import { planOptionInclude } from '../plan-options/plan-options.mapper.js';
import { toPlanConfigurationDto } from './plan-configurations.mapper.js';
import type {
  CreatePlanConfigurationInput,
  DuplicatePlanConfigurationInput,
  ListPlanConfigurationsQuery,
  UpdatePlanConfigurationInput,
} from './plan-configurations.schemas.js';

/** A configuration with its options, their field definitions and values. */
const configurationDetailInclude = {
  options: { include: planOptionInclude, orderBy: { sortOrder: 'asc' as const } },
  /** So a variant can name its network without a second request. */
  medicalNetwork: true,
  /** So it can say what it is called: "Gold+ Local". */
  plan: { select: { name: true } },
  /** The rate table, youngest first — the order it is read and edited in. */
  priceBands: { orderBy: { ageFrom: 'asc' as const } },
};

/**
 * Refuse a rate table that names the same band twice.
 *
 * The unique index would catch it, but as a constraint violation naming an
 * index. An employee who typed 25-29 twice should be told that, and told it
 * before the rest of the table is written.
 */
function assertBandsAreDistinct(bands: { ageFrom: number; ageTo: number }[]): void {
  const seen = new Set<string>();
  for (const band of bands) {
    const key = `${band.ageFrom}-${band.ageTo}`;
    if (seen.has(key)) {
      throw conflict(`This variant lists ages ${band.ageFrom}-${band.ageTo} twice.`);
    }
    seen.add(key);
  }
}

/**
 * List configurations.
 *
 * Filtering by `customerType` + `geographicalCoverage` is the query the
 * comparison engine will run: it returns every matching configuration across
 * every company and plan, which the engine then groups.
 */
export async function listPlanConfigurations(
  query: ListQuery & ListPlanConfigurationsQuery,
): Promise<Paginated<PlanConfigurationDto>> {
  const prisma = getPrisma();

  const planFilter = {
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

  const where = {
    ...activeFilter(query.isActive),
    ...(query.planId ? { planId: query.planId } : {}),
    ...(query.customerType ? { plan: { customerType: query.customerType } } : {}),
    ...(query.geographicalCoverage ? { geographicalCoverage: query.geographicalCoverage } : {}),
    ...(Object.keys(planFilter).length > 0 ? { plan: planFilter } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.planConfiguration.findMany({
      where,
      orderBy: [{ geographicalCoverage: 'asc' }, { createdAt: 'asc' }],
      ...toSkipTake(query),
    }),
    prisma.planConfiguration.count({ where }),
  ]);

  // The list carries no benefits, so no rank denominators are needed.
  return paginate(
    items.map((configuration) => toPlanConfigurationDto(configuration)),
    total,
    query,
  );
}

export async function getPlanConfiguration(id: string): Promise<PlanConfigurationDto> {
  const configuration = await getPrisma().planConfiguration.findUnique({
    where: { id },
    include: configurationDetailInclude,
  });
  if (!configuration) throw notFound('Plan configuration');
  return toPlanConfigurationDto(configuration);
}

export async function createPlanConfiguration(
  input: CreatePlanConfigurationInput,
): Promise<PlanConfigurationDto> {
  const prisma = getPrisma();

  const plan = await prisma.plan.findUnique({
    where: { id: input.planId },
    select: { id: true, companyId: true },
  });
  if (!plan) throw notFound('Plan');

  // A variant is sold on one of ITS OWN company's networks, never another's.
  await assertNetworkBelongsToCompany(plan.companyId, input.medicalNetworkId);
  await assertVariantIsDistinct(input.planId, input);

  const { priceBands = [], ...variant } = input;
  assertBandsAreDistinct(priceBands);

  const configuration = await prisma.planConfiguration.create({
    data: { ...variant, priceBands: { create: priceBands } },
    include: configurationDetailInclude,
  });
  return toPlanConfigurationDto(configuration);
}

/**
 * Refuse a variant that repeats one this plan already has.
 *
 * The unique index covers this, but only where the values are present:
 * PostgreSQL treats NULLs as distinct, so two variants that both leave the
 * network, room and ceiling unstated would slip past it. They are the same
 * offering entered twice, and the employee should be told so rather than
 * discovering two identical rows later.
 */
async function assertVariantIsDistinct(
  planId: string,
  variant: {
    geographicalCoverage?: string;
    medicalNetworkId?: string | null;
    roomType?: string | null;
    annualLimit?: number | null;
  },
  { excludeId }: { excludeId?: string } = {},
): Promise<void> {
  const twin = await getPrisma().planConfiguration.findFirst({
    where: {
      planId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      geographicalCoverage: variant.geographicalCoverage as never,
      medicalNetworkId: variant.medicalNetworkId ?? null,
      roomType: variant.roomType ?? null,
      annualLimit: variant.annualLimit ?? null,
    },
    select: { id: true },
  });
  if (twin) {
    throw conflict(
      'This plan already has that variant. Edit it instead, or change the coverage, network, room or annual limit.',
    );
  }
}

/**
 * Copy a variant to another of the same plan — "Gold+ Local" becoming
 * "Gold+ International".
 *
 * The same product sold into a wider area is the same benefits at another
 * price, and re-entering thirty of them is how mistakes get made. So the copy
 * takes them all: every attached benefit, in its order, with the value it holds
 * here, and the whole rate table with it. The new variant is then edited
 * freely — it shares nothing with its source, because each variant owns its own
 * option rows, values and bands.
 *
 * Everything the caller omits is inherited, so "the same, but international" is
 * a request with one field in it.
 */
export async function duplicatePlanConfiguration(
  id: string,
  input: DuplicatePlanConfigurationInput,
): Promise<PlanConfigurationDto> {
  const prisma = getPrisma();

  const source = await prisma.planConfiguration.findUnique({
    where: { id },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        include: { values: true, selectedChoices: true },
      },
      priceBands: { orderBy: { ageFrom: 'asc' } },
    },
  });
  if (!source) throw notFound('Plan configuration');

  /** Inherited unless the caller states otherwise — including a deliberate `null`. */
  const pick = <T>(given: T | undefined, fallback: T): T => (given === undefined ? fallback : given);

  const network = pick(input.medicalNetworkId, source.medicalNetworkId);
  const room = pick(input.roomType, source.roomType);
  const limit = pick(
    input.annualLimit,
    source.annualLimit === null ? null : Number(source.annualLimit),
  );

  const plan = await prisma.plan.findUnique({
    where: { id: source.planId },
    select: { companyId: true },
  });
  if (!plan) throw notFound('Plan');
  await assertNetworkBelongsToCompany(plan.companyId, network);

  const coverage = pick(input.geographicalCoverage, source.geographicalCoverage);

  /**
   * Something has to differ, or this is the same variant twice. The check that
   * already guards create says so in the same words.
   */
  await assertVariantIsDistinct(source.planId, {
    geographicalCoverage: coverage,
    medicalNetworkId: network,
    roomType: room,
    annualLimit: limit,
  });

  /** The source's rate table unless a new one was given outright. */
  const bands = (input.priceBands ?? source.priceBands).map((band) => ({
    ageFrom: band.ageFrom,
    ageTo: band.ageTo,
    annualPrice: band.annualPrice === null ? null : Number(band.annualPrice),
  }));
  assertBandsAreDistinct(bands);

  /** Inherited unless the caller states otherwise — including a deliberate `null`. */
  const inherit = <TKey extends keyof DuplicatePlanConfigurationInput>(key: TKey) =>
    input[key] === undefined ? source[key as keyof typeof source] : input[key];

  const created = await prisma.$transaction(async (tx) => {
    const configuration = await tx.planConfiguration.create({
      data: {
        planId: source.planId,
        geographicalCoverage: coverage,
        medicalNetworkId: network,
        roomType: room,
        priceBands: { create: bands },
        currency: inherit('currency') as string | null,
        annualLimit: inherit('annualLimit') as number | null,
        deductible: inherit('deductible') as number | null,
        coPayment: inherit('coPayment') as number | null,
        isActive: (inherit('isActive') as boolean | undefined) ?? source.isActive,
      },
      select: { id: true },
    });

    /**
     * The whole copy is three statements, not one per benefit.
     *
     * A configuration can carry dozens of benefits, each with a value, and a
     * round trip per row runs past the transaction timeout long before it runs
     * out of rows — copying a plan is exactly when there are most of them.
     * Inserting the attachments in one statement, then their values in
     * another, keeps the cost flat however large the plan is.
     */
    if (source.options.length > 0) {
      const attached = await tx.planOption.createManyAndReturn({
        data: source.options.map((planOption) => ({
          planConfigurationId: configuration.id,
          optionId: planOption.optionId,
          sortOrder: planOption.sortOrder,
          // The remark is part of what this configuration says about the
          // benefit, so the copy says it too.
          note: planOption.note,
        })),
        select: { id: true, optionId: true },
      });

      // An option appears at most once per configuration, so this is exact.
      const planOptionIdByOptionId = new Map(attached.map((row) => [row.optionId, row.id]));

      const values = source.options.flatMap((planOption) => {
        const planOptionId = planOptionIdByOptionId.get(planOption.optionId);
        if (!planOptionId) return [];
        return planOption.values.map((value) => ({
          planOptionId,
          optionFieldId: value.optionFieldId,
          numberValue: value.numberValue,
          textValue: value.textValue,
          booleanValue: value.booleanValue,
        }));
      });

      if (values.length > 0) await tx.planOptionValue.createMany({ data: values });

      /**
       * The ticked answers travel with the figures they qualify. A copy that
       * kept "800 EGP" but dropped "basic procedures only" would not be the
       * same cover — it would read as better than the plan it came from, and
       * would rank higher in a comparison.
       */
      const ticked = source.options.flatMap((planOption) => {
        const planOptionId = planOptionIdByOptionId.get(planOption.optionId);
        if (!planOptionId) return [];
        return planOption.selectedChoices.map((row) => ({
          planOptionId,
          optionFieldId: row.optionFieldId,
          choiceId: row.choiceId,
        }));
      });

      if (ticked.length > 0) {
        await tx.planOptionValueChoice.createMany({ data: ticked });
      }
    }

    return configuration;
  });

  return getPlanConfiguration(created.id);
}

export async function updatePlanConfiguration(
  id: string,
  input: UpdatePlanConfigurationInput,
): Promise<PlanConfigurationDto> {
  const { priceBands, ...variant } = input;

  /**
   * The rate table is replaced WHOLE when it is sent at all.
   *
   * Editing it band by band would need a delete endpoint for a row that has no
   * meaning on its own, and an employee who removes the 65+ line means the plan
   * is no longer sold at 65 — which is exactly the absence of a row.
   */
  if (priceBands !== undefined) assertBandsAreDistinct(priceBands);

  const configuration = await getPrisma().$transaction(async (tx) => {
    if (priceBands !== undefined) {
      await tx.planPriceBand.deleteMany({ where: { variantId: id } });
      if (priceBands.length > 0) {
        await tx.planPriceBand.createMany({
          data: priceBands.map((band) => ({ ...band, variantId: id })),
        });
      }
    }
    return tx.planConfiguration.update({
      where: { id },
      data: variant,
      include: configurationDetailInclude,
    });
  });
  return toPlanConfigurationDto(configuration);
}

/**
 * Permanent delete. The configuration owns its option assignments and their
 * values, so those cascade with it. Deactivate instead
 * (`PATCH { isActive: false }`) once the configuration has been compared or
 * quoted.
 *
 * Note the unique constraint covers active and inactive rows alike, so
 * deactivating does not free the customer-type/coverage slot — edit or delete
 * the existing configuration to reuse it.
 */
export async function deletePlanConfiguration(id: string): Promise<void> {
  await getPrisma().planConfiguration.delete({ where: { id } });
}
