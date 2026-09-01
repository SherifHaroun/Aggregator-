import {
  ALTERNATIVE_VALUE_KEY,
  CORE_MEDICAL_BENEFITS,
  CO_PAYMENT_FIELD,
  isCoreMedicalBenefit,
  medicalBenefitLookupNames,
  type InsuranceOptionDto,
  type MedicalBenefitSpec,
  type OptionFieldDto,
} from '@aggregator/shared';

/** Names compare case-insensitively, exactly as the catalogue's own rule does. */
const fold = (name: string) => name.trim().toLowerCase();

/**
 * One benefit record that actually holds values, with the fields it holds.
 *
 * A core AREA on screen is not always one record in the database. "Dental" is
 * a group in the real catalogue, and its figures live on "Dental Limit" and
 * "Dental Coverage" underneath it. The section renders those, so the employee
 * sees one heading and edits the records that exist.
 */
export interface BenefitValueTarget {
  option: InsuranceOptionDto;
  /**
   * What the plan says about this benefit, minus the co-payment, which gets a
   * column of its own, and minus the alternative phrasing, which belongs to the
   * detailed view rather than to a two-column row.
   */
  valueFields: OptionFieldDto[];
  coPaymentField: OptionFieldDto | null;
}

export interface ResolvedBenefitSection {
  /** What the heading says. */
  label: string;
  /** The catalogue record to ATTACH. For a group that is the group itself. */
  attach: InsuranceOptionDto;
  /** The records that carry the values, in catalogue order. */
  targets: BenefitValueTarget[];
}

/** A core area the catalogue has no record for, so nothing can be edited yet. */
export interface UnresolvedBenefitSection {
  label: string;
  /** Every name that was looked for, so the message can say so. */
  lookedFor: readonly string[];
}

export type CoreSection = ResolvedBenefitSection | UnresolvedBenefitSection;

export const isResolved = (section: CoreSection): section is ResolvedBenefitSection =>
  'attach' in section;

/** Every catalogue record, groups and their members alike, by folded name. */
export function flattenCatalogue(catalogue: InsuranceOptionDto[]): Map<string, InsuranceOptionDto> {
  const byName = new Map<string, InsuranceOptionDto>();
  const walk = (option: InsuranceOptionDto) => {
    byName.set(fold(option.name), option);
    for (const child of option.children ?? []) walk(child);
  };
  for (const option of catalogue) walk(option);
  return byName;
}

function toTarget(option: InsuranceOptionDto): BenefitValueTarget {
  const fields = option.fields ?? [];
  return {
    option,
    valueFields: fields.filter(
      (field) => field.key !== CO_PAYMENT_FIELD.key && field.key !== ALTERNATIVE_VALUE_KEY,
    ),
    coPaymentField: fields.find((field) => field.key === CO_PAYMENT_FIELD.key) ?? null,
  };
}

/**
 * Turn one catalogue record into the records that hold its values.
 *
 * A group holds none of its own — it is a heading — so its members are what
 * the section edits. An ordinary benefit is its own target.
 */
function targetsFor(option: InsuranceOptionDto): BenefitValueTarget[] {
  if (!option.isUmbrella) return [toTarget(option)];
  return (option.children ?? [])
    .filter((child) => (child.fields ?? []).length > 0)
    .map(toTarget);
}

/**
 * THE SIX CORE AREAS, MAPPED ONTO THE CATALOGUE THAT EXISTS.
 *
 * The labels are the business's; the records are the database's. A company
 * whose in-patient cover is filed as "Inpatient & Daycase" gets that record
 * under a heading reading "In-patient" — the same benefit, named the way the
 * document named it. Nothing is created here: an area with no matching record
 * comes back unresolved, and the screen says so rather than inventing one.
 */
export function resolveCoreSections(catalogue: InsuranceOptionDto[]): CoreSection[] {
  const byName = flattenCatalogue(catalogue);

  return CORE_MEDICAL_BENEFITS.map((spec: MedicalBenefitSpec): CoreSection => {
    const lookedFor = medicalBenefitLookupNames(spec);
    const found = lookedFor.map((name) => byName.get(fold(name))).find((match) => match !== undefined);

    if (!found) return { label: spec.name, lookedFor };
    return { label: spec.name, attach: found, targets: targetsFor(found) };
  });
}

/**
 * The benefits an employee may add to a variant: everything in the catalogue
 * that is neither a core area nor already attached.
 *
 * Groups are offered; their members are not, because attaching a group brings
 * its members with it and offering both would let the same cover be added
 * twice under two names.
 */
export function optionalBenefitChoices(
  catalogue: InsuranceOptionDto[],
  attachedOptionIds: ReadonlySet<string>,
): InsuranceOptionDto[] {
  return catalogue
    .filter((option) => !isCoreMedicalBenefit(option.name))
    .filter((option) => !attachedOptionIds.has(option.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The value-holding records of an attached optional benefit. */
export function optionalTargets(option: InsuranceOptionDto): BenefitValueTarget[] {
  return targetsFor(option);
}
