import {
  CUSTOMER_TYPE_IDS,
  GEOGRAPHICAL_COVERAGE_IDS,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
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
    insuranceTypeId: z.string().min(1),
    customerTypeId: z.enum(CUSTOMER_TYPE_IDS),
    geographicalCoverageId: z.enum(GEOGRAPHICAL_COVERAGE_IDS),
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
  })
  .superRefine((value, ctx) => {
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
