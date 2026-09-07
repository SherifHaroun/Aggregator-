import { resolveAverageAgeForCustomerType, type PlanDto } from '@aggregator/shared';
import type { Plan, PlanConfiguration, PlanPriceBand } from '@prisma/client';
import { toIso } from '../../lib/decimal.js';
import { toPlanConfigurationDto } from '../plan-configurations/plan-configurations.mapper.js';
import type { PlanOptionWithRelations } from '../plan-options/plan-options.mapper.js';

export type PlanConfigurationWithOptions = PlanConfiguration & {
  options?: PlanOptionWithRelations[];
  priceBands?: PlanPriceBand[];
};

export function toPlanDto(
  plan: Plan & {
    configurations?: PlanConfigurationWithOptions[];
    /** The shared network, when the plan was read with it. */
    medicalNetwork?: { name: string } | null;
  },
): PlanDto {
  return {
    id: plan.id,
    companyId: plan.companyId,
    customerType: plan.customerType,
    name: plan.name,
    code: plan.code,
    description: plan.description,
    medicalNetworkId: plan.medicalNetworkId,
    // Resolved when the plan was read with its network, so a row renders
    // without a second request.
    ...(plan.medicalNetwork !== undefined
      ? { medicalNetworkName: plan.medicalNetwork?.name ?? null }
      : {}),
    isActive: plan.isActive,
    createdAt: toIso(plan.createdAt),
    updatedAt: toIso(plan.updatedAt),
    /**
     * Derived, never stored. For SME this yields the standard average age and
     * its label straight from the centralized business rule, so the number
     * exists in exactly one place in the codebase.
     */
    averageAge: resolveAverageAgeForCustomerType(plan.customerType),
    ...(plan.configurations
      ? {
          configurations: plan.configurations.map((configuration) =>
            toPlanConfigurationDto(configuration),
          ),
        }
      : {}),
  };
}
