import {
  CUSTOMER_TYPE_IDS,
  ENABLED_GEOGRAPHICAL_COVERAGE_IDS,
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
/**
 * What a variant may be SAVED as: a scope still on sale.
 *
 * Existing variants recorded under a retired scope are unaffected — they are
 * read back through the enum, which still holds every value ever used.
 */
export const geographicalCoverageSchema = z.enum(ENABLED_GEOGRAPHICAL_COVERAGE_IDS);

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

/**
 * What makes one variant of a plan different from another, beyond its age band.
 *
 * All optional: a plan whose document states none of them is still one sellable
 * variant. Stating them is what lets the same plan be sold on two networks, or
 * at two ceilings, at two prices.
 */
const variantFields = {
  /** Must belong to the plan's own company — the service checks. */
  medicalNetworkId: z.string().min(1).nullable().optional(),
  /** Free text: insurers name accommodation differently. Never compared. */
  roomType: z.string().trim().min(1).max(120).nullable().optional(),
};

/**
 * ONE AGE BAND'S PRICE.
 *
 * A band with no premium is still a band: the insurer named the ages and left
 * the cell empty, and "not sold at this age" is what that means. It is stored
 * so the editor can show the row rather than silently losing it.
 */
export const priceBandSchema = orderedAgeBand(
  z.object({ ...ageBandFields, annualPrice: money.nullable().optional() }),
);

/**
 * The whole rate table, youngest first.
 *
 * Sent as a SET rather than one band at a time: an insurer's rate table is read
 * off the document in one go, and replacing it wholesale is what lets a band be
 * removed without inventing a delete endpoint for it.
 */
const priceBandsField = {
  priceBands: z.array(priceBandSchema).max(40).optional(),
};

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
  annualLimit: money.nullable().optional(),
  deductible: money.nullable().optional(),
  coPayment: z.number().min(0).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
};

/**
 * Who the plan is sold to is NOT accepted here — it belongs to the plan. A
 * variant says only where it covers and on what terms.
 */
export const createPlanConfigurationSchema = z.object({
  planId: z.string().min(1),
  geographicalCoverage: geographicalCoverageSchema,
  ...variantFields,
  ...pricingFields,
  ...priceBandsField,
});

/**
 * Coverage IS updatable, along with everything else that identifies a variant.
 *
 * Nothing moves when it changes: the benefits, their values and the rate table
 * all hang off this row and travel with it, so correcting a variant entered as
 * Local when the document said Local + International is an edit rather than a
 * re-entry. The service refuses the change when it would collide with another
 * variant of the same plan.
 *
 * `priceBands`, when given, REPLACES the whole rate table.
 */
export const updatePlanConfigurationSchema = z
  .object({
    geographicalCoverage: geographicalCoverageSchema,
    ...variantFields,
    ...pricingFields,
    ...priceBandsField,
  })
  .partial();

/**
 * Copy a variant to a different one of the same plan — "Gold+ Local" becoming
 * "Gold+ International".
 *
 * Everything omitted is inherited from the variant being copied, benefits,
 * their values and the whole rate table included. Something must differ, or the
 * copy would be the same variant twice; the service refuses that rather than
 * asking the schema to describe it.
 */
export const duplicatePlanConfigurationSchema = z.object({
  geographicalCoverage: geographicalCoverageSchema.optional(),
  ...variantFields,
  ...pricingFields,
  ...priceBandsField,
});

export const listPlanConfigurationsQueryExtension = z.object({
  planId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  /** The two criteria the comparison will search on. */
  customerType: customerTypeSchema.optional(),
  geographicalCoverage: geographicalCoverageSchema.optional(),
  medicalNetworkId: z.string().min(1).optional(),
});

export type CreatePlanConfigurationInput = z.infer<typeof createPlanConfigurationSchema>;
export type DuplicatePlanConfigurationInput = z.infer<typeof duplicatePlanConfigurationSchema>;
export type UpdatePlanConfigurationInput = z.infer<typeof updatePlanConfigurationSchema>;
export type ListPlanConfigurationsQuery = z.infer<typeof listPlanConfigurationsQueryExtension>;
