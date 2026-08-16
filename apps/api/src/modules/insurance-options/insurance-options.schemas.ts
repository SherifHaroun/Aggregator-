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
  insuranceTypeId: z.string().min(1),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  /**
   * Optional: create the option together with the information it requires.
   * Employees may equally add fields afterwards, one at a time.
   */
  fields: z.array(optionFieldInputSchema).max(50).optional(),
});

/** `insuranceTypeId` is not updatable — moving an option between types would
 *  invalidate every plan that already uses it. */
export const updateInsuranceOptionSchema = createInsuranceOptionSchema
  .omit({ insuranceTypeId: true, fields: true })
  .partial();

export const listOptionsQueryExtension = z.object({
  insuranceTypeId: z.string().min(1).optional(),
});

export type OptionFieldInput = z.infer<typeof optionFieldInputSchema>;
export type UpdateOptionFieldInput = z.infer<typeof updateOptionFieldSchema>;
export type CreateInsuranceOptionInput = z.infer<typeof createInsuranceOptionSchema>;
export type UpdateInsuranceOptionInput = z.infer<typeof updateInsuranceOptionSchema>;
