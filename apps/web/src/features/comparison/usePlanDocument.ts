import { readPlanDocument, type PlanDocumentSource as ReadSource } from '@aggregator/shared';
import { useMemo } from 'react';
import { usePlan, usePlanConfiguration } from '@/features/insurance-data/insurance-data.api';

/**
 * EVERYTHING ABOUT A PLAN THAT A COMPARISON DOES NOT CARRY, read for a screen.
 *
 * The reading itself — which attached benefits are additional, which are
 * free-text sections, the rate table in order — is `readPlanDocument` in
 * `@aggregator/shared`, because the API reads the same variant the same
 * way to email the PDF. This hook fetches the variant and the plan and
 * hands them to it.
 */
export interface PlanDocumentSource extends ReadSource {
  isLoading: boolean;
}

export { readPlanDocument };

/**
 * Read a variant for everything the comparison does not carry.
 *
 * The description belongs to the PLAN rather than to one of its variants —
 * "Gold+" is described once however many ways it is sold — so it is read from
 * there rather than copied onto each variant.
 */
export function usePlanDocumentSource(
  configurationId: string | null,
  planId?: string | null,
): PlanDocumentSource {
  const variant = usePlanConfiguration(configurationId ?? undefined);
  const plan = usePlan(planId ?? undefined);
  const read = useMemo(() => readPlanDocument(variant.data), [variant.data]);
  return {
    ...read,
    description: plan.data?.description?.trim() || null,
    isLoading: variant.isLoading,
  };
}
