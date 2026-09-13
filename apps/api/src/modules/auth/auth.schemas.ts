import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(200);

/** Everybody signs in the same way: an email and a password. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

/**
 * A customer without an account makes one: their name, their email, a
 * password of their choosing, and the company they buy for if any. No
 * phone number is asked for here — the broker collects it on the call.
 */
export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(200),
  email,
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  companyName: z
    .string()
    .trim()
    .max(200)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
});

export type LoginPayload = z.infer<typeof loginSchema>;
export type SignUpPayload = z.infer<typeof signUpSchema>;
