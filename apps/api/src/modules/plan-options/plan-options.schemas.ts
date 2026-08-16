import { z } from 'zod';

/**
 * A value for one option field. `value` is intentionally untyped here —
 * `buildValueColumns` validates it against the field definition the employee
 * created, which is not knowable at schema-compile time.
 */
export const planOptionValueInputSchema = z.object({
  optionFieldId: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
});

/** Attach an option to a plan, optionally configuring its values immediately. */
export const addPlanOptionSchema = z.object({
  optionId: z.string().min(1),
  values: z.array(planOptionValueInputSchema).max(100).optional(),
});

/** Replace the full set of values for one plan option. */
export const setPlanOptionValuesSchema = z.object({
  values: z.array(planOptionValueInputSchema).max(100),
});

export type AddPlanOptionInput = z.infer<typeof addPlanOptionSchema>;
export type SetPlanOptionValuesInput = z.infer<typeof setPlanOptionValuesSchema>;
export type PlanOptionValueInputPayload = z.infer<typeof planOptionValueInputSchema>;
