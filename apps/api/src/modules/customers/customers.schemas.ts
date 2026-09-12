import { z } from 'zod';
import { comparisonRequestSchema } from '../comparison/comparison.schemas.js';

/** Optional free-text field: trims, and treats an empty string as "cleared". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

/**
 * A customer is a name. The number and the address are taken as given —
 * a caller who gives neither is still a customer, and a form that refused
 * them until they did would lose the call.
 */
export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Enter the customer’s name.').max(200),
  phone: optionalText(50),
  email: z
    .string()
    .trim()
    .max(200)
    .transform((value) => (value === '' ? null : value))
    .pipe(z.string().email('Enter a valid email address.').nullable())
    .nullable()
    .optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

/**
 * Keep a comparison for a customer: the plan it is saved with, the selection
 * it was run from — validated exactly as the engine validates a run, so a
 * cart never holds a request the engine would refuse — and a note.
 */
export const addCartItemSchema = z.object({
  planConfigurationId: z.string().min(1),
  criteria: comparisonRequestSchema,
  note: optionalText(2000),
});

/**
 * What changes on an entry once it is in the cart: the note, and whether the
 * customer has settled on it.
 */
export const updateCartItemSchema = z
  .object({
    note: optionalText(2000),
    chosen: z.boolean().optional(),
  })
  .refine((value) => value.note !== undefined || value.chosen !== undefined, {
    message: 'Nothing to change.',
  });

export const listCustomersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type AddCartItemPayload = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
