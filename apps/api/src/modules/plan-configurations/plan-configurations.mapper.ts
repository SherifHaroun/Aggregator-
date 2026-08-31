import { variantDisplayName, type PlanConfigurationDto } from '@aggregator/shared';
import type { CompanyMedicalNetwork, PlanConfiguration, PlanPriceBand } from '@prisma/client';
import { toIso, toNumber } from '../../lib/decimal.js';
import {
  toPlanOptionDto,
  type PlanOptionWithRelations,
} from '../plan-options/plan-options.mapper.js';

export function toPlanConfigurationDto(
  configuration: PlanConfiguration & {
    options?: PlanOptionWithRelations[];
    medicalNetwork?: CompanyMedicalNetwork | null;
    plan?: { name: string } | null;
    priceBands?: PlanPriceBand[];
  },
  /** Size of each limitation scope's list — see `readLimitationRankCounts`. */
  rankCounts: Record<string, number> = {},
): PlanConfigurationDto {
  return {
    id: configuration.id,
    planId: configuration.planId,
    geographicalCoverage: configuration.geographicalCoverage,
    medicalNetworkId: configuration.medicalNetworkId,
    // Resolved when the variant was read with its network, so a row renders
    // without a second request.
    ...(configuration.medicalNetwork !== undefined
      ? { medicalNetworkName: configuration.medicalNetwork?.name ?? null }
      : {}),
    roomType: configuration.roomType,
    /**
     * "Gold+ Local" — computed from the plan's name and the scope, so renaming
     * the plan renames every variant with it and nothing can go stale.
     */
    ...(configuration.plan
      ? {
          displayName: variantDisplayName(
            configuration.plan.name,
            configuration.geographicalCoverage,
          ),
        }
      : {}),
    /**
     * Youngest first, which is the order the editor lists them in and the order
     * an insurer's own rate table is written in.
     */
    priceBands: (configuration.priceBands ?? []).map((band) => ({
      id: band.id,
      ageFrom: band.ageFrom,
      ageTo: band.ageTo,
      annualPrice: toNumber(band.annualPrice),
    })),
    currency: configuration.currency,
    annualLimit: toNumber(configuration.annualLimit),
    deductible: toNumber(configuration.deductible),
    coPayment: toNumber(configuration.coPayment),
    isActive: configuration.isActive,
    createdAt: toIso(configuration.createdAt),
    updatedAt: toIso(configuration.updatedAt),
    ...(configuration.options
      ? { options: configuration.options.map(toPlanOptionDto) }
      : {}),
  };
}
