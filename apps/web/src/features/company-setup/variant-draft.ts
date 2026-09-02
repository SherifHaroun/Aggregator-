import {
  DEFAULT_AGE_BANDS,
  ENABLED_GEOGRAPHICAL_COVERAGE_IDS,
  type GeographicalCoverageId,
} from '@aggregator/shared';

/**
 * One variant, as the entry form holds it before anything is saved.
 *
 * A variant is the plan sold one way — one coverage scope, one network, one
 * ceiling — with its own benefits and its own premium per age band. Two
 * variants of a plan are still one product, which is why they are drafted
 * together here and saved as configurations of a single plan.
 */
export interface BenefitEntry {
  /** What the plan covers. The only part a comparison reads. */
  coverage: string;
  /** Percentage as typed. Blank means the plan states no co-payment. */
  /**
   * Lines the plan states about this benefit — shown wherever the plan is
   * read, never scored. Saved as the attachment's note, one line each.
   */
  details: string[];
}

export interface BandRow {
  from: string;
  to: string;
  premium: string;
}

export interface VariantDraft {
  /** Stable across renders so React keeps each editor's DOM as rows move. */
  key: string;
  geographicalCoverage: GeographicalCoverageId;
  medicalNetworkId: string;
  annualLimit: string;
  entries: Record<string, BenefitEntry>;
  /** Optional benefits THIS variant states. Another may state none of them. */
  extras: string[];
  bands: BandRow[];
}

export const emptyEntry = (): BenefitEntry => ({ coverage: '', details: [] });

export function blankBands(): BandRow[] {
  return DEFAULT_AGE_BANDS.map((band) => ({
    from: String(band.from),
    to: String(band.to),
    premium: '',
  }));
}

let sequence = 0;

/**
 * A fresh variant.
 *
 * The scope defaults to the first one not already drafted, because the usual
 * second variant of a plan is the same product sold somewhere else — and
 * offering the scope already taken would only produce a clash on save.
 */
export function newVariant(
  coreBenefits: readonly { name: string }[],
  taken: readonly GeographicalCoverageId[] = [],
): VariantDraft {
  sequence += 1;
  // Only a scope still on sale: a retired one could not be saved anyway.
  const free = ENABLED_GEOGRAPHICAL_COVERAGE_IDS.find((id) => !taken.includes(id));
  return {
    key: `variant_${sequence}`,
    geographicalCoverage: free ?? ENABLED_GEOGRAPHICAL_COVERAGE_IDS[0],
    medicalNetworkId: '',
    annualLimit: '',
    entries: Object.fromEntries(coreBenefits.map((benefit) => [benefit.name, emptyEntry()])),
    extras: [],
    bands: blankBands(),
  };
}
