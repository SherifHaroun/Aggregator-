import {
  LIMITATION_NAME_MAX_LENGTH,
  LIMITATION_SCOPE_IDS,
  LIMITATION_WEIGHT_MAX,
  LIMITATION_WEIGHT_MIN,
} from '@aggregator/shared';
import { z } from 'zod';

/**
 * A qualification an employee has defined, e.g. "in-network only".
 *
 * `restrictionWeight` is how much of a benefit's cover the restriction removes.
 * It defaults to nothing: a limitation that has not been weighed records the
 * condition without silently altering any ranking, which is the safe direction
 * to be wrong in.
 */
export const createLimitationSchema = z.object({
  name: z.string().trim().min(1).max(LIMITATION_NAME_MAX_LENGTH),
  description: z.string().trim().max(2000).nullable().optional(),
  scope: z.enum(LIMITATION_SCOPE_IDS).optional(),
  restrictionWeight: z.number().min(LIMITATION_WEIGHT_MIN).max(LIMITATION_WEIGHT_MAX).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateLimitationSchema = createLimitationSchema.partial();

/**
 * The complete set of limitations carried by ONE benefit on ONE configuration.
 *
 * A replace rather than an add/remove pair, because that is how the control
 * behaves: the employee ticks and unticks a list and the result is saved. An
 * EMPTY ARRAY IS MEANINGFUL — it clears every restriction and states that the
 * cover has none.
 */
export const setPlanOptionLimitationsSchema = z.object({
  limitationIds: z.array(z.string().min(1)),
});

export type CreateLimitationInput = z.infer<typeof createLimitationSchema>;
export type UpdateLimitationInput = z.infer<typeof updateLimitationSchema>;
