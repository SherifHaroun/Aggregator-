import { BENEFIT_NOTE_MAX_LENGTH } from '@aggregator/shared';
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

/** Write a single value, named by its field in the path. */
export const setPlanOptionValueSchema = z.object({
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
});

/** Replace the full set of values for one plan option. */
export const setPlanOptionValuesSchema = z.object({
  values: z.array(planOptionValueInputSchema).max(100),
});

export type AddPlanOptionInput = z.infer<typeof addPlanOptionSchema>;
export type SetPlanOptionValuesInput = z.infer<typeof setPlanOptionValuesSchema>;
export type PlanOptionValueInputPayload = z.infer<typeof planOptionValueInputSchema>;

/**
 * The remark carried by one benefit on one configuration. Blank clears it, so
 * an employee deleting the text removes the note rather than storing "".
 */
export const setPlanOptionNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .max(BENEFIT_NOTE_MAX_LENGTH)
    .nullable()
    .transform((value) => (value === null || value === '' ? null : value)),
});

export type SetPlanOptionNoteInput = z.infer<typeof setPlanOptionNoteSchema>;

/**
 * The complete set of answers ticked on ONE setting.
 *
 * A replace rather than an add/remove pair, because that is how the control
 * behaves: the employee ticks and unticks a list and the result is saved. An
 * EMPTY ARRAY IS MEANINGFUL — it clears the setting and states that none of its
 * answers apply.
 */
export const setPlanOptionChoicesSchema = z.object({
  choiceIds: z.array(z.string().min(1)).max(50),
});
