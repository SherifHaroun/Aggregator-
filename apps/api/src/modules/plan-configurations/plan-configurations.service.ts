import type { Paginated, PlanConfigurationDto } from '@aggregator/shared';
import { conflict, notFound } from '../../lib/errors.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
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
};

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
    ...(query.customerType ? { customerType: query.customerType } : {}),
    ...(query.geographicalCoverage ? { geographicalCoverage: query.geographicalCoverage } : {}),
    ...(Object.keys(planFilter).length > 0 ? { plan: planFilter } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.planConfiguration.findMany({
      where,
      orderBy: [{ annualPrice: 'asc' }, { createdAt: 'asc' }],
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

  const plan = await prisma.plan.findUnique({ where: { id: input.planId }, select: { id: true } });
  if (!plan) throw notFound('Plan');

  const configuration = await prisma.planConfiguration.create({
    data: input,
    include: configurationDetailInclude,
  });
  return toPlanConfigurationDto(configuration);
}

/**
 * Copy a configuration to a different age band — "the same cover, for another
 * age".
 *
 * Insurance is priced by age, so the identical benefit set is sold ten times
 * over at ten different premiums. Re-entering thirty benefits and their values
 * for each band is how mistakes get made, so the copy takes them all: every
 * attached benefit, in its order, with the value it holds here. The new
 * configuration is then edited freely — it shares nothing with its source,
 * because each configuration owns its own option rows and values.
 *
 * Everything the caller omits is inherited, so "the same, but 26-30" is a
 * request with two numbers in it.
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
    },
  });
  if (!source) throw notFound('Plan configuration');

  const twin = await prisma.planConfiguration.findFirst({
    where: {
      planId: source.planId,
      customerType: source.customerType,
      geographicalCoverage: source.geographicalCoverage,
      ageFrom: input.ageFrom,
      ageTo: input.ageTo,
    },
    select: { id: true },
  });
  if (twin) {
    throw conflict(
      `This plan already has a configuration for ages ${input.ageFrom}-${input.ageTo} with the same customer type and coverage area. Edit that one instead.`,
    );
  }

  /** Inherited unless the caller states otherwise — including a deliberate `null`. */
  const inherit = <TKey extends keyof DuplicatePlanConfigurationInput>(key: TKey) =>
    input[key] === undefined ? source[key as keyof typeof source] : input[key];

  const created = await prisma.$transaction(async (tx) => {
    const configuration = await tx.planConfiguration.create({
      data: {
        planId: source.planId,
        customerType: source.customerType,
        geographicalCoverage: source.geographicalCoverage,
        ageFrom: input.ageFrom,
        ageTo: input.ageTo,
        currency: inherit('currency') as string | null,
        annualPrice: inherit('annualPrice') as number | null,
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
  const configuration = await getPrisma().planConfiguration.update({
    where: { id },
    data: input,
    include: configurationDetailInclude,
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
