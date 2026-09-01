/**
 * ============================================================================
 *  THE MEDICAL BENEFIT CATALOGUE THE ENTRY FORM OFFERS
 * ============================================================================
 *
 * Every name below is a column that existed in the legacy system — either in
 * `hb_medical_insurance_v` (individual medical, 44 benefit columns) or in
 * `hb_medical_public_private` (the SME group form). Nothing here is invented.
 *
 * Two groups, and the split is the one the legacy system itself made:
 *
 *  - CORE benefits are the ones the old aggregator actually COMPARED. Its
 *    pricing table carried exactly six comparable columns — the ceiling plus
 *    optical, dental, maternity and chronic as yes/no — and nothing else could
 *    reach a comparison, because the 44-column detail sheet had no key joining
 *    it to the prices. Core benefits are therefore always present on a plan.
 *
 *  - OPTIONAL benefits are the rest of that detail sheet. They are worth
 *    recording and worth showing on a plan, and a plan that never mentions
 *    them should not carry an empty box for each.
 *
 * `valueKind` is chosen from what the legacy data actually held: `750` for
 * dental is a LIMIT, `Fully Covered` for in-patient is TEXT, and a room type is
 * one entry from a ranked list. It is only the DEFAULT the benefit is created
 * with — an employee may change what a benefit carries afterwards, and a
 * benefit invented later is unaffected by anything here.
 *
 * This file names benefits; it does not own them. Once created, each is an
 * ordinary global `InsuranceOption` like any other.
 */

import type { BenefitValueKind } from './benefits.js';

export interface MedicalBenefitSpec {
  /** The benefit's catalogue name. Matching is case-insensitive. */
  name: string;
  /** Shown beside the name so a long list stays scannable. */
  emoji: string;
  /** What the benefit is created carrying, from what the legacy data held. */
  valueKind: BenefitValueKind;
  /**
   * Whether a co-payment box is offered beside the coverage box.
   *
   * The legacy form paired a `deductible_*` column with consultations,
   * ambulatory services, physiotherapy, medicines, dental and optical — and
   * those columns held PERCENTAGES (`0%`, `10%`, `15%`, `20%`, `25%`), which is
   * a co-payment, not a deductible, whatever the column was called.
   */
  coPayment: boolean;
  order: number;
  /**
   * OTHER NAMES THE SAME BENEFIT IS ALREADY FILED UNDER.
   *
   * The catalogue is the source of truth, and it was not written by this form.
   * A company's in-patient cover may already exist as "Inpatient and daycare
   * Details" — the same benefit, named the way the document named it — and
   * creating "In-patient" beside it would leave one plan's cover in one record
   * and the next plan's in another, with nothing able to compare them.
   *
   * So an alias is not a display name. It is a claim that the catalogue record
   * bearing it IS this benefit, and the entry form must attach to it rather
   * than create anything.
   */
  aliases?: readonly string[];
}

/** The label of the co-payment field created beside a coverage field. */
export const CO_PAYMENT_FIELD = {
  label: 'Co-payment',
  key: 'co_payment',
  dataType: 'PERCENTAGE',
  unit: '%',
} as const;

/**
 * Detail lines a plan states about a benefit — "10 sessions per year",
 * "80% reimbursement", "covered at authorized centers".
 *
 * They are DISPLAY ONLY: shown wherever the plan is read, never scored. The
 * legacy system had no room for them and crammed them into the coverage value
 * ("12 Sessions", "Covered up to 3,000"), which is why a comparison could never
 * read those plans properly.
 *
 * Stored as the attachment's note, one line per entry, because a note is not
 * information the benefit requires — any attachment may carry one.
 */
export const BENEFIT_DETAIL_SEPARATOR = '\n';

/**
 * WHAT A CORE BENEFIT IS WORTH, IN ONE FIGURE.
 *
 * A plan document states a core area one of two ways: a ceiling in money
 * ("Dental up to 25,000") or a share of the bill ("Dental at 80%"). It does not
 * state both, and offering both boxes invites an employee to invent whichever
 * the document is silent about.
 *
 * So the employee picks which one this plan uses and fills in that figure.
 * Everything else the document says — waiting periods, member ratios, named
 * exclusions — is DETAIL: it qualifies the figure rather than competing with
 * it, and it is read when somebody opens a plan rather than when plans are
 * ranked against each other.
 */
export const CORE_VALUE_KINDS = {
  LIMIT: {
    id: 'LIMIT',
    label: 'Limit',
    dataType: 'CURRENCY',
    key: 'limit',
    fieldLabel: 'Limit',
    unit: null,
  },
  COVERAGE: {
    id: 'COVERAGE',
    label: 'Coverage %',
    dataType: 'PERCENTAGE',
    key: 'coverage_percentage',
    fieldLabel: 'Coverage',
    unit: '%',
  },
} as const;

export type CoreValueKindId = keyof typeof CORE_VALUE_KINDS;

export const CORE_VALUE_KIND_IDS = ['LIMIT', 'COVERAGE'] as const;

/** Placeholder on an optional benefit's detail box. */
export const BENEFIT_DETAIL_PLACEHOLDER = 'Write any detail about this benefit…';

/** What an optional benefit records when it is ticked but nothing is typed. */
export const BENEFIT_INCLUDED_LABEL = 'Covered';

/**
 * Always on a medical plan, because these are what a comparison reads.
 *
 * Chronic and pre-existing are ONE benefit here. The legacy system kept them as
 * two columns, but its most common chronic value was
 * "Covered up to the limit if not pre-existing" — a single sentence about both
 * — and its pricing table carried only `chronic`. Splitting them invited two
 * answers to one question.
 */
/**
 * THE SIX AREAS A COMPARISON READS, each quoted ONE way.
 *
 * The way is fixed by the business, not chosen per plan: in-patient and
 * out-patient are always a share of the bill, and maternity, dental, optical
 * and chronic cover are always a ceiling. That is how the documents state them,
 * and a comparison can only rank plans against each other when they are all
 * answering the same question.
 *
 * A ZERO is not a small figure — it is the plan saying it does not cover this.
 * Nothing else in the model needs to know that; the comparison and the plan's
 * own detail both read it off the figure.
 */
export const CORE_MEDICAL_BENEFITS: readonly MedicalBenefitSpec[] = [
  {
    name: 'In-patient',
    emoji: '🏥',
    valueKind: 'PERCENTAGE',
    coPayment: true,
    order: 1,
    aliases: [
      'Inpatient & Daycase',
      'Inpatient and daycare Details',
      'Inpatient Details',
      'In-patient Details',
      'Inpatient',
    ],
  },
  {
    name: 'Out-patient',
    emoji: '🩺',
    valueKind: 'PERCENTAGE',
    coPayment: true,
    order: 2,
    aliases: ['Outpatient', 'Outpatient Details', 'Out-patient Details'],
  },
  {
    name: 'Maternity',
    emoji: '🤰',
    valueKind: 'LIMIT',
    coPayment: true,
    order: 3,
    aliases: ['Maternity Details'],
  },
  {
    name: 'Dental',
    emoji: '🦷',
    valueKind: 'LIMIT',
    coPayment: true,
    order: 4,
    aliases: ['Dental Details'],
  },
  {
    name: 'Optical',
    emoji: '👓',
    valueKind: 'LIMIT',
    coPayment: true,
    order: 5,
    aliases: ['Optical Details'],
  },
  {
    name: 'Chronic / Pre-existing Conditions',
    emoji: '🧬',
    valueKind: 'LIMIT',
    coPayment: true,
    order: 6,
    aliases: [
      'Pre-existing & Chronic Conditions',
      'Chronic and Pre-existing Conditions',
      'Pre-existing Conditions',
      'Chronic Conditions',
    ],
  },
];

/**
 * Added only when a plan actually states them.
 *
 * ALL TEXT, deliberately. These are extra detail — whatever the document says
 * about the benefit, in whatever form it says it. "15,000" and "covered at
 * authorized centres" are both complete answers, and a box that accepted only
 * one of them would refuse half the documents. Nothing here is compared, so
 * nothing here needs to be a number.
 */
export const OPTIONAL_MEDICAL_BENEFITS: readonly MedicalBenefitSpec[] = [
  /**
   * Text rather than a ranked list, for now.
   *
   * A room type IS ranked cover — a private room beats a shared one — and the
   * catalogue supports saying so. But a RANK benefit is only meaningful once
   * its answers have been put in order, and that is done on the benefits
   * screen. Created as text, it records what the plan says from day one and
   * can be promoted to a ranked benefit later without losing a value.
   */
  { name: 'Room Type', emoji: '🛏️', valueKind: 'TEXT', coPayment: false, order: 10 },
  { name: 'Consultations', emoji: '👩‍⚕️', valueKind: 'TEXT', coPayment: false, order: 11 },
  { name: 'Medicines', emoji: '💊', valueKind: 'TEXT', coPayment: false, order: 12 },
  { name: 'Physiotherapy', emoji: '🤸', valueKind: 'TEXT', coPayment: false, order: 13 },
  { name: 'New Born Baby', emoji: '👶', valueKind: 'TEXT', coPayment: false, order: 14 },
  {
    name: 'Accompanying Family Member',
    emoji: '👨‍👩‍👧',
    valueKind: 'TEXT',
    coPayment: false,
    order: 15,
  },
  { name: 'Organ Transplantation', emoji: '🫁', valueKind: 'TEXT', coPayment: false, order: 16 },
  {
    name: 'Organ Transplantation Surgery',
    emoji: '⚕️',
    valueKind: 'TEXT',
    coPayment: false,
    order: 17,
  },
  { name: 'Road Ambulance', emoji: '🚑', valueKind: 'TEXT', coPayment: false, order: 18 },
  { name: 'Morgue / Last Expenses', emoji: '⚰️', valueKind: 'TEXT', coPayment: false, order: 19 },
  { name: 'Personal Accident', emoji: '⚠️', valueKind: 'TEXT', coPayment: false, order: 20 },
  { name: 'Home Care', emoji: '🏠', valueKind: 'TEXT', coPayment: false, order: 21 },
  { name: 'Heart Procedures', emoji: '🫀', valueKind: 'TEXT', coPayment: false, order: 22 },
  { name: 'Cancer Treatment', emoji: '🎗️', valueKind: 'TEXT', coPayment: false, order: 23 },
  { name: 'Hepatitis B & C', emoji: '🧫', valueKind: 'TEXT', coPayment: false, order: 24 },
  { name: 'Prosthesis & Stents', emoji: '🦾', valueKind: 'TEXT', coPayment: false, order: 25 },
  {
    name: 'Emergency Cases Outside Region',
    emoji: '🚨',
    valueKind: 'TEXT',
    coPayment: false,
    order: 26,
  },
  {
    name: 'Emergency Medical Treatment Outside Egypt',
    emoji: '✈️',
    valueKind: 'TEXT',
    coPayment: false,
    order: 27,
  },
  { name: 'Work Related Accidents', emoji: '👷', valueKind: 'TEXT', coPayment: false, order: 28 },
  {
    name: 'Expert Second Medical Opinion',
    emoji: '💬',
    valueKind: 'TEXT',
    coPayment: false,
    order: 29,
  },
  { name: 'Area Coverage', emoji: '🌍', valueKind: 'TEXT', coPayment: false, order: 30 },
];

/** Every benefit this form knows how to offer, core first. */
export const MEDICAL_BENEFITS: readonly MedicalBenefitSpec[] = [
  ...CORE_MEDICAL_BENEFITS,
  ...OPTIONAL_MEDICAL_BENEFITS,
];

/** Names compare case-insensitively, exactly as the catalogue's own rule does. */
function fold(name: string): string {
  return name.trim().toLowerCase();
}

const BY_NAME = new Map(
  MEDICAL_BENEFITS.flatMap((benefit) =>
    [benefit.name, ...(benefit.aliases ?? [])].map(
      (name) => [fold(name), benefit] as [string, MedicalBenefitSpec],
    ),
  ),
);

/**
 * The spec for a benefit name, or `null` for one an employee invented.
 *
 * Aliases resolve here too, so a catalogue record named the way a document
 * named it is recognised as the benefit it actually is.
 */
export function medicalBenefitSpec(name: string): MedicalBenefitSpec | null {
  return BY_NAME.get(fold(name)) ?? null;
}

/**
 * Every name a benefit might already be filed under, its own first.
 *
 * The entry form walks this against the live catalogue and attaches to the
 * first record it finds, so an existing benefit is reused rather than
 * duplicated under a tidier name.
 */
export function medicalBenefitLookupNames(spec: MedicalBenefitSpec): readonly string[] {
  return [spec.name, ...(spec.aliases ?? [])];
}

/** The emoji for a benefit name. Falls back to a neutral mark. */
export function benefitEmoji(name: string): string {
  return medicalBenefitSpec(name)?.emoji ?? '📄';
}

export function isCoreMedicalBenefit(name: string): boolean {
  return CORE_MEDICAL_BENEFITS.some((benefit) =>
    medicalBenefitLookupNames(benefit).some((alias) => fold(alias) === fold(name)),
  );
}

// ---------------------------------------------------------------------------
//  AGE BANDS
// ---------------------------------------------------------------------------

/**
 * The age bands the form starts from.
 *
 * Read off the legacy pricing table: across all 32 products every price change
 * fell on one of these ages. Two conventions were in use — one insurer broke at
 * 30/35/40, another at 31/36/41 — so these are a STARTING POINT the employee
 * edits, never a rule. Rows are added and removed freely.
 *
 * The open-ended last band is deliberate: a plan states a price up to some age
 * and simply is not sold beyond it.
 */
export const DEFAULT_AGE_BANDS: readonly { from: number; to: number }[] = [
  { from: 1, to: 17 },
  { from: 18, to: 24 },
  { from: 25, to: 29 },
  { from: 30, to: 34 },
  { from: 35, to: 39 },
  { from: 40, to: 44 },
  { from: 45, to: 49 },
  { from: 50, to: 54 },
  { from: 55, to: 59 },
  { from: 60, to: 64 },
];

/**
 * What a band with no premium means.
 *
 * The legacy data said this two ways — an empty cell in one table, the literal
 * text "Not Covered" in the other — for one fact: the plan is not sold at that
 * age. A band left blank here is simply not created.
 */
export const AGE_BAND_NOT_SOLD_LABEL = 'Not covered';

// ---------------------------------------------------------------------------
//  WHAT A NETWORK GIVES ACCESS TO
// ---------------------------------------------------------------------------

/**
 * The provider categories a network's estate is described in.
 *
 * Every one of these was a column in the legacy
 * `hb_group_medical_network_summary` table, filled in once per provider and
 * shown against every plan sold on it. That was the one thing the old schema
 * genuinely normalised, and it is worth keeping.
 *
 * A STARTING LIST, not a closed one: the categories are stored as rows, so an
 * employee may record one nobody anticipated. Nothing here is required.
 */
export const NETWORK_PROVIDER_CATEGORIES: readonly { name: string; emoji: string }[] = [
  { name: 'Hospitals', emoji: '🏥' },
  { name: 'Polyclinics', emoji: '🏬' },
  { name: 'Physicians', emoji: '👩‍⚕️' },
  { name: 'Pharmacies', emoji: '💊' },
  { name: 'Laboratories', emoji: '🧪' },
  { name: 'Radiology Centers', emoji: '🩻' },
  { name: 'Dental Centers', emoji: '🦷' },
  { name: 'Optical Centers', emoji: '👓' },
  { name: 'Physiotherapy Centers', emoji: '🤸' },
  { name: 'Specialized Medical Centers', emoji: '⚕️' },
];

/** Longest a category name may be. */
export const NETWORK_PROVIDER_CATEGORY_MAX_LENGTH = 120;

/** Longest the wording beside a figure may be. */
export const NETWORK_PROVIDER_DETAIL_MAX_LENGTH = 500;

/** Most categories one network may describe. */
export const NETWORK_PROVIDER_MAX = 40;

/** Shown on a network whose estate nobody has recorded yet. */
export const NO_NETWORK_PROVIDERS_LABEL =
  'No provider information yet — add it once here and every plan on this network shows it.';

/** The emoji for a provider category, or a neutral mark for an invented one. */
export function networkProviderEmoji(category: string): string {
  const match = NETWORK_PROVIDER_CATEGORIES.find(
    (item) => item.name.trim().toLowerCase() === category.trim().toLowerCase(),
  );
  return match?.emoji ?? '📍';
}
