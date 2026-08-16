import { CUSTOMER_TYPE_IDS, GEOGRAPHICAL_COVERAGE_IDS } from '@aggregator/shared';
import { z } from 'zod';

const money = z.number().min(0).max(9_999_999_999.99);

/**
 * Customer type and coverage are validated against the centralized business
 * configuration, never against a list retyped here.
 */
export const customerTypeSchema = z.enum(CUSTOMER_TYPE_IDS);
export const geographicalCoverageSchema = z.enum(GEOGRAPHICAL_COVERAGE_IDS);

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

export const createPlanConfigurationSchema = z.object({
  planId: z.string().min(1),
  customerType: customerTypeSchema,
  geographicalCoverage: geographicalCoverageSchema,
  ...pricingFields,
});

/**
 * Customer type and coverage are not updatable: they identify the
 * configuration, and changing them would silently move every option value
 * attached to it. Delete the configuration and create the right one instead.
 */
export const updatePlanConfigurationSchema = z.object(pricingFields);

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
