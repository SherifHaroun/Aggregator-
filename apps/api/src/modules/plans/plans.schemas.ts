import { CUSTOMER_TYPE_IDS } from '@aggregator/shared';
import { z } from 'zod';

/**
 * A plan carries only what is true of the product itself, plus WHO it is sold
 * to. Price, limits, network and coverage area live on its variants, because
 * they are what differs between them.
 */
export const createPlanSchema = z.object({
  companyId: z.string().min(1),
  insuranceTypeId: z.string().min(1),
  /**
   * Individual, Family and SME are separate products that merely share a name,
   * so this is required: a plan with no buyer could not be filed under any of
   * the three sections a company is managed through.
   */
  customerType: z.enum(CUSTOMER_TYPE_IDS),
  name: z.string().trim().min(1).max(200),
  /** Unique per company. */
  code: z.string().trim().min(1).max(60),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * The insurance type and the customer type ARE changeable; the company is not.
 *
 * Filing a plan under the wrong buyer is an ordinary mistake, and correcting it
 * moves the whole product — its variants, their benefits and their prices —
 * from one section to another. Nothing mixes: a plan has one customer type
 * before the edit and one after.
 *
 * Benefits are global — they belong to no insurance type — so moving a plan
 * between types invalidates nothing it carries. All it changes is which
 * comparison the plan turns up in, which is exactly what an employee means when
 * they file a plan under the wrong type and want it corrected.
 *
 * The company stays fixed because it decides what the plan's code has to be
 * unique against, and because a plan's history belongs with the company that
 * sold it.
 */
export const updatePlanSchema = createPlanSchema.omit({ companyId: true }).partial();

/**
 * Copy a plan, with the configurations the employee picked.
 *
 * The name is REQUIRED and must differ from the plan being copied — that is the
 * whole point of a copy, and two plans of one company reading the same is how
 * an employee prices the wrong one. The code is derived from the new name when
 * it is not given, exactly as it is when a plan is created.
 *
 * `configurationIds` selects what comes across. Omitted, every configuration
 * comes; an empty list copies the plan on its own, which is a legitimate way to
 * start a plan that shares only its description.
 */
export const duplicatePlanSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  configurationIds: z.array(z.string().min(1)).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const listPlansQueryExtension = z.object({
  companyId: z.string().min(1).optional(),
  insuranceTypeId: z.string().min(1).optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type DuplicatePlanInput = z.infer<typeof duplicatePlanSchema>;
