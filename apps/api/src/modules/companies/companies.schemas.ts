import { z } from 'zod';

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
 * A logo is either an absolute URL, or the `/uploads/...` path returned by the
 * upload endpoint. Anything else is rejected — in particular a bare relative
 * path, which would resolve differently depending on the page.
 */
const logoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => /^https?:\/\//i.test(value) || /^\/uploads\/[\w.-]+$/.test(value),
    'Provide an image URL, or upload a file.',
  );

export const createCompanySchema = z.object({
  name: z.string().trim().min(1).max(200),
  shortName: optionalText(60),
  logoUrl: logoUrlSchema.nullable().optional(),
  description: optionalText(2000),
  website: z.string().trim().url().max(500).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  phone: optionalText(50),
  mobile: optionalText(50),
  address: optionalText(500),
  isActive: z.boolean().optional(),
});

/** Every field optional; `isActive` is how a company is deactivated/reactivated. */
export const updateCompanySchema = createCompanySchema.partial();

/** One provider network the company sells. Its rank is written by reorder. */
export const createMedicalNetworkSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: optionalText(500),
});

export const updateMedicalNetworkSchema = createMedicalNetworkSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/** The company's whole list, best first. */
export const reorderMedicalNetworksSchema = z.object({
  orderedIds: z.array(z.string().min(1)).max(200),
});

/** Deleting a network plans are sold on takes a deliberate `force=true`. */
export const deleteMedicalNetworkQuerySchema = z.object({
  force: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type CreateMedicalNetworkInput = z.infer<typeof createMedicalNetworkSchema>;
export type UpdateMedicalNetworkInput = z.infer<typeof updateMedicalNetworkSchema>;

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
