import {
  CUSTOMER_TYPE_IDS,
  GEOGRAPHICAL_COVERAGE_IDS,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
} from '@aggregator/shared';
import { z } from 'zod';

const money = z.number().min(0).max(9_999_999_999.99);

/**
 * Customer type and coverage are validated against the centralized business
 * configuration, never against a list retyped here.
 */
export const customerTypeSchema = z.enum(CUSTOMER_TYPE_IDS);
export const geographicalCoverageSchema = z.enum(GEOGRAPHICAL_COVERAGE_IDS);

/**
 * One end of a configuration's age band.
 *
 * A whole number within the insurable range — text, decimals and negatives are
 * rejected here rather than reaching the database.
 */
const age = z
  .number({ invalid_type_error: 'Enter an age as a number.' })
  .int('Enter a whole number of years.')
  .min(MIN_INSURABLE_AGE, `An age cannot be below ${MIN_INSURABLE_AGE}.`)
  .max(MAX_INSURABLE_AGE, `An age cannot be above ${MAX_INSURABLE_AGE}.`);

/** Both bounds are required, and the band has to run forwards. */
const ageBandFields = {
  ageFrom: age,
  ageTo: age,
};

/** Rejects a band that runs backwards, and says which field to fix. */
const orderedAgeBand = <TSchema extends z.ZodTypeAny>(schema: TSchema) =>
  schema.superRefine((value: { ageFrom?: number; ageTo?: number }, ctx: z.RefinementCtx) => {
    if (value.ageFrom === undefined || value.ageTo === undefined) return;
    if (value.ageFrom > value.ageTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ageFrom'],
        message: 'Age From cannot be greater than Age To.',
      });
    }
  });

const pricingFields = {
  /** ISO 4217, e.g. "EGP". May differ between local and international. */
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Za-z]{3}$/, 'Use a three-letter currency code.')
    .transform((value) => value.toUpperCase())
    .nullable()
    .optional(),
  annualPrice: money.nullable().optional(),
  annualLimit: money.nullable().optional(),
  deductible: money.nullable().optional(),
  coPayment: z.number().min(0).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
};

export const createPlanConfigurationSchema = orderedAgeBand(
  z.object({
    planId: z.string().min(1),
    customerType: customerTypeSchema,
    geographicalCoverage: geographicalCoverageSchema,
    ...ageBandFields,
    ...pricingFields,
  }),
);

/**
 * Customer type and coverage are not updatable: they identify the
 * configuration, and changing them would silently move every option value
 * attached to it. Delete the configuration and create the right one instead.
 */
export const updatePlanConfigurationSchema = orderedAgeBand(
  z.object({ ...ageBandFields, ...pricingFields }).partial(),
);

export const listPlanConfigurationsQueryExtension = z.object({
  planId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  insuranceTypeId: z.string().min(1).optional(),
  /** The two criteria the comparison will search on. */
  customerType: customerTypeSchema.optional(),
  geographicalCoverage: geographicalCoverageSchema.optional(),
});

export type CreatePlanConfigurationInput = z.infer<typeof createPlanConfigurationSchema>;
export type UpdatePlanConfigurationInput = z.infer<typeof updatePlanConfigurationSchema>;
export type ListPlanConfigurationsQuery = z.infer<typeof listPlanConfigurationsQueryExtension>;
