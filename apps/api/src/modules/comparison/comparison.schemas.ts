import {
  CUSTOMER_TYPE_IDS,
  ENABLED_GEOGRAPHICAL_COVERAGE_IDS,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  PLAN_TIER_IDS,
  describeSmeDistributionProblem,
  isSmeAgeBracketId,
} from '@aggregator/shared';
import { z } from 'zod';

/**
 * What a customer submits to run a comparison.
 *
 * Every id refers to a database record; the two enums come from the shared
 * business configuration, so the API can never accept a customer type the rest
 * of the system does not know.
 */
const comparisonAge = z
  .number({ invalid_type_error: 'Enter an age as a number.' })
  .int('Enter a whole number of years.')
  .min(MIN_INSURABLE_AGE, `An age cannot be below ${MIN_INSURABLE_AGE}.`)
  .max(MAX_INSURABLE_AGE, `An age cannot be above ${MAX_INSURABLE_AGE}.`);

export const comparisonRequestSchema = z
  .object({
    /**
     * How good the plan has to be, read off its annual limit rather than a
     * category anybody filed it under. Optional: a customer with no view on it
     * is shown every tier.
     */
    planTierId: z.enum(PLAN_TIER_IDS).optional(),
    customerTypeId: z.enum(CUSTOMER_TYPE_IDS),
    /**
     * Only a scope still on sale. A retired one cannot be asked for, whatever
     * the request was built by — there is nothing left to match it against.
     */
    geographicalCoverageId: z.enum(ENABLED_GEOGRAPHICAL_COVERAGE_IDS),
    /** ISO 4217, as stored on the configuration. */
    currency: z.string().trim().length(3).toUpperCase(),
    /**
     * The ages to cover, youngest to oldest. One person sends the same value
     * twice. Compared numerically against each configuration's band, never as
     * text.
     */
    ageFrom: comparisonAge,
    ageTo: comparisonAge,
    /**
     * What the customer is comfortable paying per year. Omitted, no price
     * ceiling applies and every matching plan is considered.
     */
    budget: z
      .number({ invalid_type_error: 'Enter a budget as a number.' })
      .min(0, 'A budget cannot be negative.')
      .max(9_999_999_999.99)
      .optional(),
    /**
     * HOW MANY EMPLOYEES ARE IN EACH AGE BRACKET — an SME's answer to "who is
     * being insured", because a business has a workforce rather than an age.
     *
     * The bracket ids and the rules they are checked against both come from
     * `@aggregator/shared`, so the API can never accept a bracket the screen
     * does not draw, nor refuse one it does.
     */
    smeEmployees: z
      .record(z.string(), z.number())
      .refine((counts) => Object.keys(counts).every(isSmeAgeBracketId), {
        message: 'That is not an age bracket.',
      })
      .superRefine((counts, ctx) => {
        const problem = describeSmeDistributionProblem(counts);
        if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    /**
     * Only an SME has a workforce. A distribution sent for an individual would
     * be priced against nothing and silently ignored, so it is refused instead.
     */
    if (value.smeEmployees && value.customerTypeId !== 'SME') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['smeEmployees'],
        message: 'Only an SME is priced by employee age bracket.',
      });
    }
    if (value.ageFrom > value.ageTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ageFrom'],
        message: 'Age From cannot be greater than Age To.',
      });
    }
  });

/**
 * The same requirements minus the budget — used to work out what the matching
 * plans cost before the employee commits to a figure.
 */
export const comparisonPriceRangeSchema = comparisonRequestSchema
  .innerType()
  .omit({ budget: true });

export type ComparisonPriceRangePayload = z.infer<typeof comparisonPriceRangeSchema>;

export type ComparisonRequestPayload = z.infer<typeof comparisonRequestSchema>;
