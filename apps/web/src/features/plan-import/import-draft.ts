/**
 * THE MODEL'S ANSWER, AS DRAFTS THE PLAN EDITOR ALREADY KNOWS.
 *
 * The review screen is the add-plan form, pre-filled. So the answer is turned
 * into the same `VariantDraft` the form edits and `savePlanDraft` writes —
 * the import invents no second way of holding a plan. Everything the document
 * stated lands somewhere an employee can see and change:
 *
 *   figure, co-payment      → the core area's two boxes
 *   limitations, details    → the area's detail lines
 *   "Maternity: 10 months"  → a detail line on Maternity
 *   additional benefits     → optional benefits, catalogue name where matched
 *   room type               → the variant's room, and the Room Type benefit
 *   conditions, exclusions  → lines kept with the plan, saved into its description
 *
 * A blank ceiling is left blank: the comparison reads it as the annual limit
 * and the review screen holds the plan until a person has confirmed that.
 */

import {
  CORE_MEDICAL_BENEFITS,
  ENABLED_GEOGRAPHICAL_COVERAGE_IDS,
  importReviewWarnings,
  medicalBenefitLookupNames,
  medicalBenefitSpec,
  readyToPublish,
  reviewWarningKey,
  type ImportReviewWarning,
  type ImportedDocument,
  type ImportedPlan,
  type ImportedVariant,
  type MedicalNetworkDto,
} from '@aggregator/shared';
import {
  blankBands,
  emptyEntry,
  type BenefitEntry,
  type VariantDraft,
} from '../company-setup/variant-draft';

/** The value that means "create a network with the document's name". */
export const CREATE_NETWORK = '__create__';

/** The catalogue's optional benefit that holds the room. */
const ROOM_TYPE_BENEFIT = 'Room Type';
/** Carried by the plan itself, never as a benefit. */
const NETWORK_AS_BENEFIT = 'medical network';

/** A plan's description may hold this much. */
const DESCRIPTION_LIMIT = 2000;

export interface ImportPlanDraft {
  key: string;
  name: string;
  description: string;
  /** The network the document names; '' when it names none. */
  networkName: string;
  /** For the employee's eye only: tiers are negotiated per deal and never saved. */
  tierCode: string;
  /** A network on the shared list, `CREATE_NETWORK`, or '' for none. */
  medicalNetworkId: string;
  variants: VariantDraft[];
  /** Lines that are not benefits, kept editable and saved into the description. */
  waitingPeriods: string[];
  conditions: string[];
  exclusions: string[];
  /** Warning keys the employee has confirmed. */
  confirmed: string[];
  /** Left out of the publish. */
  skipped: boolean;
}

const fold = (text: string) => text.trim().toLowerCase();

const stringOf = (value: number | null) => (value === null ? '' : String(value));

let sequence = 0;

/** "Maternity: 10 months" → the core area it names, if it names one. */
function coreAreaOfLine(line: string): string | null {
  const colon = line.indexOf(':');
  if (colon <= 0) return null;
  const head = fold(line.slice(0, colon));
  for (const spec of CORE_MEDICAL_BENEFITS) {
    if (medicalBenefitLookupNames(spec).some((name) => fold(name) === head)) return spec.name;
  }
  return null;
}

function pushUnique(lines: string[], line: string): void {
  const text = line.trim();
  if (text !== '' && !lines.some((existing) => fold(existing) === fold(text))) lines.push(text);
}

/** One imported variant as the editor holds it. */
export function toVariantDraft(variant: ImportedVariant): {
  draft: VariantDraft;
  unplacedWaitingPeriods: string[];
} {
  sequence += 1;
  const entries: Record<string, BenefitEntry> = {};
  for (const spec of CORE_MEDICAL_BENEFITS) {
    const cell = variant.coreBenefits.find((benefit) => fold(benefit.name) === fold(spec.name));
    const entry = emptyEntry();
    if (cell) {
      entry.coverage = stringOf(cell.value);
      entry.coPayment = stringOf(cell.coPayment);
      pushUnique(entry.details, cell.details);
      for (const limitation of cell.limitations) pushUnique(entry.details, limitation);
    }
    entries[spec.name] = entry;
  }

  const unplacedWaitingPeriods: string[] = [];
  for (const line of variant.waitingPeriods) {
    const area = coreAreaOfLine(line);
    if (area)
      pushUnique(
        entries[area]!.details,
        `Waiting period: ${line.slice(line.indexOf(':') + 1).trim()}`,
      );
    else unplacedWaitingPeriods.push(line);
  }

  const extras: string[] = [];
  for (const benefit of variant.additionalBenefits) {
    const name = (benefit.matchedExisting.trim() || benefit.name).trim();
    if (name === '' || fold(name) === NETWORK_AS_BENEFIT) continue;

    const spec = medicalBenefitSpec(name);
    const core = spec && CORE_MEDICAL_BENEFITS.some((item) => item.name === spec.name);
    if (core) {
      // The document said more about an area it already has a figure for.
      pushUnique(entries[spec.name]!.details, benefit.value);
      pushUnique(entries[spec.name]!.details, benefit.details);
      continue;
    }

    const label = spec?.name ?? name;
    if (!extras.includes(label)) extras.push(label);
    const entry = entries[label] ?? emptyEntry();
    if (entry.coverage.trim() === '') entry.coverage = benefit.value.trim();
    pushUnique(entry.details, benefit.details);
    entries[label] = entry;
  }

  const room = variant.roomType.trim();
  if (room !== '' && !extras.includes(ROOM_TYPE_BENEFIT)) {
    extras.push(ROOM_TYPE_BENEFIT);
    entries[ROOM_TYPE_BENEFIT] = { ...emptyEntry(), coverage: room };
  }

  const coverage = ENABLED_GEOGRAPHICAL_COVERAGE_IDS.includes(variant.geographicalCoverage)
    ? variant.geographicalCoverage
    : ENABLED_GEOGRAPHICAL_COVERAGE_IDS[0];

  const bands =
    variant.priceBands.length > 0
      ? variant.priceBands.map((band) => ({
          from: String(band.ageFrom),
          to: String(band.ageTo),
          premium: stringOf(band.annualPrice),
        }))
      : blankBands();

  return {
    draft: {
      key: `import_variant_${sequence}`,
      geographicalCoverage: coverage,
      annualLimit: stringOf(variant.annualLimit),
      entries,
      extras,
      bands,
      currency: variant.currency.trim(),
      roomType: room,
      deductible: stringOf(variant.deductible),
      coPayment: stringOf(variant.coPayment),
    },
    unplacedWaitingPeriods,
  };
}

/** The network on the shared list with this name, ignoring case. */
export function matchNetwork(name: string, networks: readonly MedicalNetworkDto[]): string {
  const wanted = fold(name);
  if (wanted === '') return '';
  return networks.find((network) => fold(network.name) === wanted)?.id ?? CREATE_NETWORK;
}

export function toPlanDraft(
  plan: ImportedPlan,
  networks: readonly MedicalNetworkDto[],
): ImportPlanDraft {
  sequence += 1;
  const variants = plan.variants.map(toVariantDraft);
  const waitingPeriods: string[] = [];
  const conditions: string[] = [];
  const exclusions: string[] = [];
  for (const [index, variant] of plan.variants.entries()) {
    for (const line of variants[index]!.unplacedWaitingPeriods) pushUnique(waitingPeriods, line);
    for (const line of variant.conditions) pushUnique(conditions, line);
    for (const line of variant.exclusions) pushUnique(exclusions, line);
  }

  return {
    key: `import_plan_${sequence}`,
    name: plan.name.trim(),
    description: plan.description.trim(),
    networkName: plan.medicalNetwork.name.trim(),
    tierCode: plan.medicalNetwork.tierCode.trim(),
    medicalNetworkId: matchNetwork(plan.medicalNetwork.name, networks),
    variants: variants.map((item) => item.draft),
    waitingPeriods,
    conditions,
    exclusions,
    confirmed: [],
    skipped: false,
  };
}

export function toPlanDrafts(
  document: ImportedDocument,
  networks: readonly MedicalNetworkDto[],
): ImportPlanDraft[] {
  return document.plans.map((plan) => toPlanDraft(plan, networks));
}

/** The figure typed in a core box, as the review rule reads it. */
function typedValue(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, '');
  if (trimmed === '') return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

/**
 * Every warning a draft raises, across its variants. The key names the
 * variant too, so confirming one variant's Dental does not confirm another's.
 */
export function draftWarnings(draft: ImportPlanDraft): ImportReviewWarning[] {
  return draft.variants.flatMap((variant, index) =>
    importReviewWarnings({
      name: `${draft.key}:${index}`,
      currency: variant.currency?.trim() || null,
      annualLimit: typedValue(variant.annualLimit),
      coreBenefits: CORE_MEDICAL_BENEFITS.map((spec) => ({
        name: spec.name,
        value: typedValue(variant.entries[spec.name]?.coverage ?? ''),
      })),
    }),
  );
}

export { reviewWarningKey };

/** Whether a draft may be published: skipped, or every warning confirmed. */
export function draftReady(draft: ImportPlanDraft): boolean {
  return draft.skipped || readyToPublish(draftWarnings(draft), new Set(draft.confirmed));
}

/**
 * The description the plan is saved with: the document's summary, then the
 * lines that are not benefits, each under its heading.
 */
export function descriptionForPublish(draft: ImportPlanDraft): string {
  const sections: string[] = [];
  if (draft.description.trim() !== '') sections.push(draft.description.trim());
  const block = (title: string, lines: string[]) => {
    const kept = lines.map((line) => line.trim()).filter((line) => line !== '');
    if (kept.length > 0) sections.push(`${title}:\n${kept.map((line) => `- ${line}`).join('\n')}`);
  };
  block('Waiting periods', draft.waitingPeriods);
  block('Conditions', draft.conditions);
  block('Exclusions', draft.exclusions);
  return sections.join('\n\n').slice(0, DESCRIPTION_LIMIT);
}
