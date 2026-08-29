import {
  BENEFIT_CHOICE_LABEL_MAX_LENGTH,
  BENEFIT_VALUE_KIND_IDS,
  CUSTOMER_TYPE_IDS,
  OPTION_FIELD_DATA_TYPES_IDS,
} from '@aggregator/shared';
import { z } from 'zod';

/** Definition of one field an option requires. */
export const optionFieldInputSchema = z.object({
  label: z.string().trim().min(1).max(120),
  /** Derived from the label when omitted. Unique within the option. */
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, digits and underscores only.')
    .optional(),
  dataType: z.enum(OPTION_FIELD_DATA_TYPES_IDS),
  unit: z.string().trim().max(30).nullable().optional(),
  helpText: z.string().trim().max(500).nullable().optional(),
  isRequired: z.boolean().optional(),
  /**
   * An ADDITIONAL CONDITION rather than a core field: a toggle whose input
   * appears only once an employee says the document states it.
   */
  isOptional: z.boolean().optional(),
  /**
   * The condition this input belongs to, for conditions that need more than one
   * box — "1 in 20 members", "10 sessions per year".
   */
  parentFieldId: z.string().min(1).nullable().optional(),
  /**
   * Show this input only when the parent's answer is this one — the mechanism
   * behind "Other", "Specific procedures" and "Subject to conditions".
   */
  showWhenChoiceId: z.string().min(1).nullable().optional(),
  /** Which customer types this setting applies to. Omitted means all of them. */
  customerTypes: z.array(z.enum(CUSTOMER_TYPE_IDS)).optional(),
  isActive: z.boolean().optional(),
});

export const updateOptionFieldSchema = optionFieldInputSchema.omit({ key: true }).partial();

export const createInsuranceOptionSchema = z.object({
  /** Unique across the whole catalogue — a benefit is global. */
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  /**
   * What the benefit carries: a percentage, a limit or text. This is the only
   * thing the web client sends besides the name — the field definition behind
   * it comes from `BENEFIT_VALUE_KINDS`, so no employee configures a data type.
   * Ignored for an umbrella, which carries nothing.
   */
  valueKind: z.enum(BENEFIT_VALUE_KIND_IDS).optional(),
  /**
   * A SECOND value the benefit may carry, quoted as an alternative to the
   * first — "800 EGP, or 80%". Omitted, the benefit carries one value; `null`
   * on an update removes the alternative and the figures recorded against it.
   */
  alternativeKind: z.enum(BENEFIT_VALUE_KIND_IDS).nullable().optional(),
  /**
   * An umbrella groups sub-benefits and holds no value of its own, so it is
   * created with no fields at all.
   */
  isUmbrella: z.boolean().optional(),
  /** The umbrella this benefit belongs under. Omitted for a top-level benefit. */
  parentId: z.string().min(1).nullable().optional(),
  /**
   * Optional. Omitted — which is what the web client always does — the benefit
   * is created with the single value its kind describes. Supplying fields
   * explicitly remains possible for benefits that need another shape.
   */
  fields: z.array(optionFieldInputSchema).max(50).optional(),
});

/**
 * Fields are managed through their own endpoints, never on the option body —
 * with one exception: `valueKind`, which says what the benefit carries. That is
 * a product-level decision rather than a field definition, and changing it
 * migrates the values already recorded (see the service).
 *
 * The benefit's place in the hierarchy is NOT editable: moving a benefit
 * between umbrellas would silently rearrange every configuration that carries
 * it. Create the benefit where it belongs.
 */
export const updateInsuranceOptionSchema = createInsuranceOptionSchema
  .omit({ fields: true, isUmbrella: true, parentId: true })
  .partial();

export type OptionFieldInput = z.infer<typeof optionFieldInputSchema>;
export type UpdateOptionFieldInput = z.infer<typeof updateOptionFieldSchema>;
export type CreateInsuranceOptionInput = z.infer<typeof createInsuranceOptionSchema>;
export type UpdateInsuranceOptionInput = z.infer<typeof updateInsuranceOptionSchema>;

/**
 * One answer a benefit offers. On a ranked benefit its POSITION is the ranking,
 * which is why the order is written through its own endpoint rather than by
 * sending a number here.
 */
export const createOptionChoiceSchema = z.object({
  label: z.string().trim().min(1).max(BENEFIT_CHOICE_LABEL_MAX_LENGTH),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateOptionChoiceSchema = z.object({
  label: z.string().trim().min(1).max(BENEFIT_CHOICE_LABEL_MAX_LENGTH).optional(),
  isActive: z.boolean().optional(),
});

/** The complete list, best first. */
export const reorderOptionChoicesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).max(200),
});

export type CreateOptionChoiceInput = z.infer<typeof createOptionChoiceSchema>;
export type UpdateOptionChoiceInput = z.infer<typeof updateOptionChoiceSchema>;

/**
 * Deleting a benefit that something depends on takes a deliberate `force=true`,
 * so a stray DELETE can never quietly strip a benefit off every plan.
 */
export const deleteInsuranceOptionQuerySchema = z.object({
  force: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
