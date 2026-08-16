import { z } from 'zod';

export const createInsuranceTypeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** Optional: derived from the name when omitted. Immutable afterwards. */
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, digits and underscores only.')
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/** `code` is deliberately not updatable — other records address the type by it. */
export const updateInsuranceTypeSchema = createInsuranceTypeSchema.omit({ code: true }).partial();

export type CreateInsuranceTypeInput = z.infer<typeof createInsuranceTypeSchema>;
export type UpdateInsuranceTypeInput = z.infer<typeof updateInsuranceTypeSchema>;
