import { resolveAverageAgeForCustomerType, type PlanConfigurationDto } from '@aggregator/shared';
import type { CompanyMedicalNetwork, PlanConfiguration } from '@prisma/client';
import { toIso, toNumber } from '../../lib/decimal.js';
import {
  toPlanOptionDto,
  type PlanOptionWithRelations,
} from '../plan-options/plan-options.mapper.js';

export function toPlanConfigurationDto(
  configuration: PlanConfiguration & {
    options?: PlanOptionWithRelations[];
    medicalNetwork?: CompanyMedicalNetwork | null;
  },
  /** Size of each limitation scope's list — see `readLimitationRankCounts`. */
  rankCounts: Record<string, number> = {},
): PlanConfigurationDto {
  return {
    id: configuration.id,
    planId: configuration.planId,
    customerType: configuration.customerType,
    geographicalCoverage: configuration.geographicalCoverage,
    medicalNetworkId: configuration.medicalNetworkId,
    // Resolved when the variant was read with its network, so a row renders
    // without a second request.
    ...(configuration.medicalNetwork !== undefined
      ? { medicalNetworkName: configuration.medicalNetwork?.name ?? null }
      : {}),
    roomType: configuration.roomType,
    ageFrom: configuration.ageFrom,
    ageTo: configuration.ageTo,
    currency: configuration.currency,
    annualPrice: toNumber(configuration.annualPrice),
    annualLimit: toNumber(configuration.annualLimit),
    deductible: toNumber(configuration.deductible),
    coPayment: toNumber(configuration.coPayment),
    /**
     * Derived, never stored. For SME this yields the standard average age and
     * its label straight from the centralized business rule, so the number
     * exists in exactly one place in the codebase.
     */
    averageAge: resolveAverageAgeForCustomerType(configuration.customerType),
    isActive: configuration.isActive,
    createdAt: toIso(configuration.createdAt),
    updatedAt: toIso(configuration.updatedAt),
    ...(configuration.options
      ? { options: configuration.options.map(toPlanOptionDto) }
      : {}),
  };
}
