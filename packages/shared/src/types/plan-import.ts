/**
 * WHAT THE PLAN IMPORT RETURNS — the document, read into the database's shape.
 *
 * An employee uploads an insurer's Word document; the API converts it, has the
 * model transcribe every plan in it, and hands the answer to the review screen
 * as these types. Every field here is something the review screen shows and
 * the employee can change before anything is published. Nothing is written to
 * the database by the import itself.
 *
 * Only NUMBERS are nullable: for a number, null ("the document is silent") and
 * 0 ("the document declines it") mean different things. A text the document
 * gives nothing for is "".
 */

import type { CustomerTypeId } from '../config/customer-types.js';
import type { GeographicalCoverageId } from '../config/geographical-coverage.js';

/** One of the seven core areas, as the document states it. */
export interface ImportedCoreBenefit {
  /** The catalogue name, exactly. */
  name: string;
  kind: 'COVERAGE' | 'LIMIT';
  /** The figure. null = the document is silent; 0 = the document declines it. */
  value: number | null;
  /** The member's share, as a percentage. null = none stated. */
  coPayment: number | null;
  /** Conditions that narrow the cover: "In-network only". */
  limitations: string[];
  /** Everything else the cell says, word for word. */
  details: string;
  /** A short verbatim quote of where the figure came from. */
  source: string;
}

/** A benefit outside the seven, stated by being present. */
export interface ImportedAdditionalBenefit {
  name: string;
  /** The catalogue name this was matched to, or "" when it is new. */
  matchedExisting: string;
  /** The document's wording, or a figure as text. */
  value: string;
  details: string;
  source: string;
}

export interface ImportedPriceBand {
  ageFrom: number;
  ageTo: number;
  /** null = the document lists the band without a price, or "not covered". */
  annualPrice: number | null;
  source: string;
}

/** The plan sold one way: one scope, one ceiling, one rate table. */
export interface ImportedVariant {
  geographicalCoverage: GeographicalCoverageId;
  roomType: string;
  currency: string;
  annualLimit: number | null;
  deductible: number | null;
  /** A plan-wide co-payment, if the document states one. */
  coPayment: number | null;
  priceBands: ImportedPriceBand[];
  /** All seven, in the fixed order. */
  coreBenefits: ImportedCoreBenefit[];
  additionalBenefits: ImportedAdditionalBenefit[];
  /** "Maternity: 10 months", one per line. */
  waitingPeriods: string[];
  /** Eligibility and policy terms: group size, age limits, discounts. */
  conditions: string[];
  exclusions: string[];
}

export interface ImportedPlan {
  name: string;
  /** The document's own summary of the plan, tier wording included. */
  description: string;
  medicalNetwork: {
    /** The network's NAME only — "Full Network". */
    name: string;
    /** Any tier code the document attaches; never part of the name. */
    tierCode: string;
    source: string;
  };
  variants: ImportedVariant[];
}

/** The whole answer for one document. */
export interface ImportedDocument {
  document: {
    title: string;
    insurerNameInDocument: string;
    /** Whether the document's insurer is the company it was imported into. */
    matchesCompany: boolean;
    currency: string;
    /** Why the model read this as a document for the chosen customer type. */
    sectionEvidence: string;
  };
  /** Announced first, in document order, so progress can count against it. */
  planNames: string[];
  plans: ImportedPlan[];
  /** Anything odd the model noticed: a skipped band, a tier label at odds with the limit. */
  warnings: string[];
  /** Text the model could not place on any plan, quoted. */
  unplaced: string[];
}

/**
 * Where an import is, from upload to answer.
 *
 * The stages are what the screen shows and the percentage is worked out from
 * them (see `PLAN_IMPORT_STAGES`). READING is the long one: the model streams
 * its answer and every plan it completes moves the bar.
 */
export type PlanImportStatus =
  'CONVERTING' | 'SENDING' | 'READING' | 'VALIDATING' | 'DONE' | 'FAILED';

export interface PlanImportJobDto {
  id: string;
  companyId: string;
  /** The section every plan in the answer will be published into. */
  customerType: CustomerTypeId;
  fileName: string;
  status: PlanImportStatus;
  /** 0–100, monotonic. */
  percent: number;
  /** The plan names the model announced, once it has. */
  planNames: string[];
  /** How many of them it has finished writing. */
  plansCompleted: number;
  /** The answer, once DONE. */
  result: ImportedDocument | null;
  /** Why it failed, once FAILED. In words, for the employee. */
  error: string | null;
  /** ISO 8601. */
  createdAt: string;
}
