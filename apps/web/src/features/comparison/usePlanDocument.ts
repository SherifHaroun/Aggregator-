import {
  CORE_BENEFIT_ORDER,
  formatNumber,
  medicalBenefitSpec,
  type PlanConfigurationDto,
  type PlanOptionDto,
  type PlanOptionValueDto,
} from '@aggregator/shared';
import { useMemo } from 'react';
import { usePlan, usePlanConfiguration } from '@/features/insurance-data/insurance-data.api';
import type { DocumentBenefit } from './plan-document';

/**
 * EVERYTHING ABOUT A PLAN THAT A COMPARISON DOES NOT CARRY.
 *
 * A comparison result holds the six areas it ranked on and nothing else — by
 * design, since the additional benefits are what a plan states in words and
 * cannot be scored. The full page and the PDF want them, so the variant itself
 * is read for them.
 *
 * The six are excluded here rather than filtered later: they are already the
 * spine of every screen this feeds, and listing them twice would read as the
 * plan covering dental twice over.
 */

const CORE = new Set(CORE_BENEFIT_ORDER.map((name) => name.trim().toLowerCase()));

/** Free-text sections a plan may carry, recognised by what the benefit is called. */
const SECTIONS = [
  { key: 'waitingPeriods' as const, matches: /waiting/i },
  { key: 'conditions' as const, matches: /condition|term|eligib|age limit|group size/i },
  { key: 'exclusions' as const, matches: /exclusion|not covered|excluded/i },
];

export interface PlanDocumentSource {
  additional: DocumentBenefit[];
  waitingPeriods: string[];
  conditions: string[];
  exclusions: string[];
  description: string | null;
  isLoading: boolean;
}

/**
 * What one recorded value says, in the plan's own terms.
 *
 * A figure keeps its unit — a percentage is not a ceiling — and a benefit
 * recorded with no figure at all says nothing here, because its presence on
 * the plan is already the statement.
 */
function statedValue(value: PlanOptionValueDto): string | null {
  if (value.value === null || value.value === '') return null;
  if (typeof value.value === 'boolean') return value.value ? 'Covered' : 'Not covered';
  if (typeof value.value === 'number') {
    return value.unit ? `${formatNumber(value.value)}${value.unit}` : formatNumber(value.value);
  }
  /**
   * A ranked answer is stored as the CHOICE'S ID, so the wording has to be
   * looked up — printing the id puts a database key in front of a customer.
   */
  if (value.dataType === 'RANK') {
    const chosen =
      value.choiceLabel ??
      (value.choices ?? []).find((choice) => choice.id === value.value)?.label ??
      null;
    return chosen;
  }
  return String(value.value);
}

/** Whether a NAME is one of the six, under any of the wordings they are filed as. */
function namesCoreArea(name: string): boolean {
  if (CORE.has(name.trim().toLowerCase())) return true;
  // The catalogue records the areas under the insurers' own wording, so the
  // shared aliases decide, exactly as the comparison decides its columns.
  const spec = medicalBenefitSpec(name);
  return spec ? CORE.has(spec.name.trim().toLowerCase()) : false;
}

/**
 * Whether an attached benefit is part of one of the six.
 *
 * A core area is often a GROUP in the catalogue — "Dental" holding "Dental
 * Limit" and "Dental Coverage" — and its members are the same cover written
 * out, not extra benefits. Listed again below they read as a plan covering
 * dental twice, once compared and once not.
 */
function isCore(attached: PlanOptionDto, byId: Map<string, PlanOptionDto>): boolean {
  if (namesCoreArea(attached.optionName)) return true;
  const parent = attached.parentOptionId ? byId.get(attached.parentOptionId) : undefined;
  return parent ? namesCoreArea(parent.optionName) : false;
}

export function readPlanDocument(
  variant: PlanConfigurationDto | undefined,
): Omit<PlanDocumentSource, 'isLoading' | 'description'> {
  const additional: DocumentBenefit[] = [];
  const waitingPeriods: string[] = [];
  const conditions: string[] = [];
  const exclusions: string[] = [];

  const byOptionId = new Map((variant?.options ?? []).map((row) => [row.optionId, row]));

  for (const attached of variant?.options ?? []) {
    const name = attached.optionName;
    if (isCore(attached, byOptionId)) continue;

    const details = (attached.note ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    /**
     * A benefit whose NAME says what section it belongs to becomes that
     * section rather than another line in the list — "Waiting Period: 10
     * months" is not a benefit the plan provides.
     */
    const section = SECTIONS.find((entry) => entry.matches.test(name));
    if (section) {
      const lines = details.length ? details.map((line) => `${name}: ${line}`) : [name];
      if (section.key === 'waitingPeriods') waitingPeriods.push(...lines);
      if (section.key === 'conditions') conditions.push(...lines);
      if (section.key === 'exclusions') exclusions.push(...lines);
      continue;
    }

    const stated = (attached.values ?? [])
      .map(statedValue)
      .filter((text): text is string => text !== null);

    additional.push({ name, value: stated[0] ?? null, details });
  }

  return {
    additional,
    waitingPeriods,
    conditions,
    exclusions,
  };
}

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
