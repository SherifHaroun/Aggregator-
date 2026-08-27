/**
 * The shapes a benefit can be created with.
 *
 * An employee invents a benefit by typing a name and saying WHAT KIND OF VALUE
 * it carries — a percentage ("Outpatient: 80%"), a limit ("Optical: 600 EGP")
 * or plain text ("Medical network: Golden Care"). That single choice is the
 * whole configuration: no field, data type or unit is ever asked for.
 *
 * A benefit may instead be an UMBRELLA, which carries no value of its own and
 * exists to group sub-benefits beneath it (life & accident coverage grouping
 * death, disability and so on). An umbrella is created with no value field at
 * all, which is why the kinds below describe only benefits that hold a value.
 *
 * The generic option-field model underneath is unchanged: a benefit is still an
 * `InsuranceOption` with `OptionField`s, so a benefit that needs a different
 * shape remains representable and older ones keep rendering. These constants
 * are simply the shapes the product creates.
 */

import type { OptionFieldDataType } from './option-field-types.js';
import type { ConfigOption, OptionRegistry } from './option-registry.js';

export interface BenefitValueField {
  label: string;
  /** Stable machine key, unique within the benefit. */
  key: string;
  dataType: OptionFieldDataType;
  /** Shown after the value. `null` means the value speaks for itself. */
  unit: string | null;
}

/** The kinds of value a benefit can carry, as offered when creating one. */
export const BENEFIT_VALUE_KIND_IDS = ['PERCENTAGE', 'LIMIT', 'TEXT'] as const;

export type BenefitValueKind = (typeof BENEFIT_VALUE_KIND_IDS)[number];

export interface BenefitValueKindOption extends ConfigOption<BenefitValueKind> {
  /** The single field a benefit of this kind is created with. */
  field: BenefitValueField;
}

export const BENEFIT_VALUE_KINDS: OptionRegistry<BenefitValueKind, BenefitValueKindOption> = {
  PERCENTAGE: {
    id: 'PERCENTAGE',
    label: 'Percentage',
    description: 'A share of the cost, e.g. 80% coverage.',
    order: 1,
    enabled: true,
    field: { label: 'Percentage', key: 'percentage', dataType: 'PERCENTAGE', unit: '%' },
  },
  LIMIT: {
    id: 'LIMIT',
    label: 'Limit',
    description: 'A maximum amount, in the currency of the configuration.',
    order: 2,
    enabled: true,
    field: { label: 'Limit', key: 'limit', dataType: 'CURRENCY', unit: null },
  },
  TEXT: {
    id: 'TEXT',
    label: 'Text',
    description: 'Wording rather than a number, e.g. a provider network.',
    order: 3,
    enabled: true,
    field: { label: 'Details', key: 'details', dataType: 'TEXT', unit: null },
  },
};

/** What a benefit carries when the employee expresses no preference. */
export const DEFAULT_BENEFIT_VALUE_KIND: BenefitValueKind = 'PERCENTAGE';

/**
 * The default benefit shape — a single percentage.
 *
 * Kept as its own constant because it is what every benefit created before the
 * kind was offered carries.
 */
export const BENEFIT_VALUE_FIELD: Readonly<BenefitValueField> =
  BENEFIT_VALUE_KINDS[DEFAULT_BENEFIT_VALUE_KIND].field;

/** The field definition a benefit of this kind is created with. */
export function benefitValueField(kind: BenefitValueKind): BenefitValueField {
  return BENEFIT_VALUE_KINDS[kind].field;
}

/**
 * Which kind a stored field represents, or `null` for a data type no kind uses
 * (a benefit created through the general API rather than the product's own
 * workflow).
 */
export function benefitKindForDataType(dataType: OptionFieldDataType): BenefitValueKind | null {
  const match = Object.values(BENEFIT_VALUE_KINDS).find((kind) => kind.field.dataType === dataType);
  return match?.id ?? null;
}

/**
 * How deep the benefit hierarchy goes: an umbrella holds sub-benefits, and a
 * sub-benefit holds nothing. One level is what the business describes, and
 * bounding it here keeps every screen able to render the whole tree.
 */
export const MAX_BENEFIT_DEPTH = 2;
