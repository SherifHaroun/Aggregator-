import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(200);

/** The broker signs in with an email and a password. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export type LoginPayload = z.infer<typeof loginSchema>;
