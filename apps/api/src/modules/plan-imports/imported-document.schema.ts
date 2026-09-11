/**
 * THE ANSWER, CHECKED — before the review screen is handed it.
 *
 * Structured output guarantees the shape the API enforces, but the review
 * screen is a form built from this data, and a form built from something
 * half-shaped is worse than an error. So the answer is parsed against the
 * shared `ImportedDocument` type here, once, and only a whole one goes out.
 */

import {
  CORE_MEDICAL_BENEFITS,
  ENABLED_GEOGRAPHICAL_COVERAGE_IDS,
  type ImportedDocument,
} from '@aggregator/shared';
import { z } from 'zod';

const text = z.string();
const money = z.number().nullable();

const coreBenefitSchema = z.object({
  name: z.enum(CORE_MEDICAL_BENEFITS.map((spec) => spec.name) as [string, ...string[]]),
  kind: z.enum(['COVERAGE', 'LIMIT']),
  value: money,
  coPayment: money,
  limitations: z.array(text),
  details: text,
  source: text,
});

const additionalBenefitSchema = z.object({
  name: text,
  matchedExisting: text,
  value: text,
  details: text,
  source: text,
});

const priceBandSchema = z.object({
  ageFrom: z.number().int(),
  ageTo: z.number().int(),
  annualPrice: money,
  source: text,
});

const variantSchema = z.object({
  geographicalCoverage: z.enum(ENABLED_GEOGRAPHICAL_COVERAGE_IDS),
  roomType: text,
  currency: text,
  annualLimit: money,
  deductible: money,
  coPayment: money,
  priceBands: z.array(priceBandSchema),
  coreBenefits: z.array(coreBenefitSchema),
  additionalBenefits: z.array(additionalBenefitSchema),
  waitingPeriods: z.array(text),
  conditions: z.array(text),
  exclusions: z.array(text),
});

const planSchema = z.object({
  name: text,
  description: text,
  medicalNetwork: z.object({ name: text, tierCode: text, source: text }),
  variants: z.array(variantSchema),
});

export const importedDocumentSchema: z.ZodType<ImportedDocument> = z.object({
  document: z.object({
    title: text,
    insurerNameInDocument: text,
    matchesCompany: z.boolean(),
    currency: text,
    sectionEvidence: text,
  }),
  planNames: z.array(text),
  plans: z.array(planSchema),
  warnings: z.array(text),
  unplaced: z.array(text),
});
