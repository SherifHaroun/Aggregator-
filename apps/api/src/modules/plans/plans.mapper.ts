import type { PlanDto } from '@aggregator/shared';
import type { Plan, PlanConfiguration } from '@prisma/client';
import { toIso } from '../../lib/decimal.js';
import { toPlanConfigurationDto } from '../plan-configurations/plan-configurations.mapper.js';
import type { PlanOptionWithRelations } from '../plan-options/plan-options.mapper.js';

export type PlanConfigurationWithOptions = PlanConfiguration & {
  options?: PlanOptionWithRelations[];
};

export function toPlanDto(
  plan: Plan & { configurations?: PlanConfigurationWithOptions[] },
): PlanDto {
  return {
    id: plan.id,
    companyId: plan.companyId,
    insuranceTypeId: plan.insuranceTypeId,
    name: plan.name,
    code: plan.code,
    description: plan.description,
    isActive: plan.isActive,
    createdAt: toIso(plan.createdAt),
    updatedAt: toIso(plan.updatedAt),
    ...(plan.configurations
      ? { configurations: plan.configurations.map(toPlanConfigurationDto) }
      : {}),
  };
}
