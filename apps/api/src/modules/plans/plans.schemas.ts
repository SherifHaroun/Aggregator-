import { z } from 'zod';

/**
 * A plan carries only what is true of the product itself. Price, limits,
 * deductible and co-payment live on `PlanConfiguration`, because they differ
 * per customer type and coverage area.
 */
export const createPlanSchema = z.object({
  companyId: z.string().min(1),
  insuranceTypeId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  /** Unique per company. */
  code: z.string().trim().min(1).max(60),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

/** Company and insurance type are fixed at creation — changing either would
 *  invalidate the options already attached to the plan's configurations. */
export const updatePlanSchema = createPlanSchema
  .omit({ companyId: true, insuranceTypeId: true })
  .partial();

export const listPlansQueryExtension = z.object({
  companyId: z.string().min(1).optional(),
  insuranceTypeId: z.string().min(1).optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
