import { OPTION_FIELD_DATA_TYPES_IDS } from '@aggregator/shared';
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
  isActive: z.boolean().optional(),
});

export const updateOptionFieldSchema = optionFieldInputSchema.omit({ key: true }).partial();

export const createInsuranceOptionSchema = z.object({
  /** Unique across the whole catalogue — a benefit is global. */
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  /**
   * Optional. Omitted — which is what the web client always does — the benefit
   * is created with the standard single percentage value. Supplying fields
   * explicitly remains possible for benefits that need another shape.
   */
  fields: z.array(optionFieldInputSchema).max(50).optional(),
});

/** Fields are managed through their own endpoints, never on the option body. */
export const updateInsuranceOptionSchema = createInsuranceOptionSchema
  .omit({ fields: true })
  .partial();

export type OptionFieldInput = z.infer<typeof optionFieldInputSchema>;
export type UpdateOptionFieldInput = z.infer<typeof updateOptionFieldSchema>;
export type CreateInsuranceOptionInput = z.infer<typeof createInsuranceOptionSchema>;
export type UpdateInsuranceOptionInput = z.infer<typeof updateInsuranceOptionSchema>;
