import type { Paginated, PlanConfigurationDto } from '@aggregator/shared';
import { notFound } from '../../lib/errors.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
import { planOptionInclude } from '../plan-options/plan-options.mapper.js';
import { toPlanConfigurationDto } from './plan-configurations.mapper.js';
import type {
  CreatePlanConfigurationInput,
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

  return paginate(items.map(toPlanConfigurationDto), total, query);
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
