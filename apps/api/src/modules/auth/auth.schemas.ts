import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter your email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

/**
 * A customer signs in with who they are and how to reach them. All three are
 * asked for: the broker calls the customer back about what they kept, and a
 * cart with nobody to ring is no use to anyone.
 */
export const customerLoginSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(200),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),
  phone: z
    .string()
    .trim()
    .min(6, 'Enter your phone number.')
    .max(50)
    .regex(/^[+\d][\d\s()-]*$/, 'Enter a valid phone number.'),
});
