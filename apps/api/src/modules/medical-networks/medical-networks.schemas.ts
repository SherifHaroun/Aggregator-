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

/** A query flag: `?x=true` is on, anything else is off. */
const flag = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

/** One network on the shared list. Its position is written by reorder. */
export const createMedicalNetworkSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: optionalText(500),
});

export const updateMedicalNetworkSchema = createMedicalNetworkSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/** The whole list, best first. */
export const reorderMedicalNetworksSchema = z.object({
  orderedIds: z.array(z.string().min(1)).max(200),
});

/** Deleting a network plans are sold on takes a deliberate `force=true`. */
export const deleteMedicalNetworkQuerySchema = z.object({ force: flag });

/**
 * The list is what a plan may choose from, so it is the active networks
 * unless the caller — the management screen — asks for the retired ones too.
 */
export const listMedicalNetworksQuerySchema = z.object({ includeInactive: flag });

export type CreateMedicalNetworkInput = z.infer<typeof createMedicalNetworkSchema>;
export type UpdateMedicalNetworkInput = z.infer<typeof updateMedicalNetworkSchema>;
