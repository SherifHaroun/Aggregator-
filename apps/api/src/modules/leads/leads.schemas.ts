import { z } from 'zod';
import { comparisonRequestSchema } from '../comparison/comparison.schemas.js';

const name = (what: string) =>
  z.string().trim().min(1, `Enter your ${what}.`).max(100, `Your ${what} is too long.`);

/**
 * THE ONE FINAL STEP. A visitor who has filled in the compare card gives
 * these before seeing the results. Everything but the company is required:
 * without a name and a way to reach them there is nobody to call, and the
 * whole point of the step is the call.
 *
 * The comparison travels with it, validated exactly as the engine validates
 * a run, so a lead never holds a request the engine would refuse.
 */
export const createLeadSchema = z.object({
  firstName: name('first name'),
  lastName: name('last name'),
  phone: z
    .string()
    .trim()
    .min(6, 'Enter your mobile number.')
    .max(40, 'That mobile number is too long.')
    .regex(/^[+\d][\d\s()-]*$/, 'Enter a mobile number using digits only.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),
  companyName: z
    .string()
    .trim()
    .max(200)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  criteria: comparisonRequestSchema,
});

/** Opening a plan in full, or choosing it: which one. */
export const leadPlanSchema = z.object({
  planConfigurationId: z.string().min(1),
});

export type CreateLeadPayload = z.infer<typeof createLeadSchema>;
export type LeadPlanPayload = z.infer<typeof leadPlanSchema>;
