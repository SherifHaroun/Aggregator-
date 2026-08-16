import type { Paginated, PlanDto } from '@aggregator/shared';
import { notFound } from '../../lib/errors.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
import { planOptionInclude } from '../plan-options/plan-options.mapper.js';
import { toPlanDto } from './plans.mapper.js';
import type { CreatePlanInput, UpdatePlanInput } from './plans.schemas.js';

/**
 * A plan together with every configuration, and each configuration's options,
 * field definitions and values — the whole product in one response.
 */
const planDetailInclude = {
  configurations: {
    include: { options: { include: planOptionInclude, orderBy: { sortOrder: 'asc' as const } } },
    orderBy: [{ customerType: 'asc' as const }, { geographicalCoverage: 'asc' as const }],
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

export async function updatePlan(id: string, input: UpdatePlanInput): Promise<PlanDto> {
  const plan = await getPrisma().plan.update({
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
