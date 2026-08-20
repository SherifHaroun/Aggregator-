/**
 * API contracts for the insurance data.
 *
 * These describe the SHAPE of records, never their content. No company, plan,
 * option or benefit is named anywhere in this file — every one of them is a
 * database record created by an employee.
 *
 * Monetary and numeric values cross the wire as `number`.
 */

import type { CustomerTypeId } from '../config/customer-types.js';
import type { GeographicalCoverageId } from '../config/geographical-coverage.js';
import type { OptionFieldDataType } from '../config/option-field-types.js';
import type { ResolvedAverageAge } from './comparison.js';

/** Fields shared by every insurance record. */
export interface RecordMeta {
  id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDto extends RecordMeta {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  description: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
}

export interface InsuranceTypeDto extends RecordMeta {
  name: string;
  code: string;
  description: string | null;
  sortOrder: number;
}

/**
 * A benefit/feature an employee has defined, e.g. anything from outpatient care
 * to a benefit that does not exist yet.
 *
 * GLOBAL: defined once and offered to every company and plan. What differs
 * between them is the value it takes, which lives on `PlanOptionValueDto`.
 */
export interface InsuranceOptionDto extends RecordMeta {
  /** Unique across the catalogue. */
  name: string;
  description: string | null;
  sortOrder: number;
  /** Present when the option was fetched with its field definitions. */
  fields?: OptionFieldDto[];
}

/** One piece of information an option requires, defined by an employee. */
export interface OptionFieldDto extends RecordMeta {
  optionId: string;
  label: string;
  /** Stable machine key, unique within the option. Derived from the label. */
  key: string;
  dataType: OptionFieldDataType;
  unit: string | null;
  helpText: string | null;
  isRequired: boolean;
  sortOrder: number;
}

/**
 * The insurance product itself. Carries no price and no benefits — those differ
 * per customer type and coverage area and live on `PlanConfigurationDto`.
 */
export interface PlanDto extends RecordMeta {
  companyId: string;
  insuranceTypeId: string;
  name: string;
  code: string;
  description: string | null;
  category: string | null;
  /** Present when the plan was fetched with its configurations. */
  configurations?: PlanConfigurationDto[];
}

/**
 * One plan priced and configured for a specific customer type and coverage
 * area. This is what the comparison searches and what a result card renders.
 */
export interface PlanConfigurationDto extends RecordMeta {
  planId: string;
  customerType: CustomerTypeId;
  geographicalCoverage: GeographicalCoverageId;
  /** Inclusive age band this configuration applies to. Both always present. */
  ageFrom: number;
  ageTo: number;
  currency: string | null;
  annualPrice: number | null;
  annualLimit: number | null;
  deductible: number | null;
  coPayment: number | null;
  /**
   * Resolved from the centralized business rules — never stored in the
   * database. For SME this carries the standard average age and its label.
   */
  averageAge: ResolvedAverageAge;
  /** Present when the configuration was fetched with its options. */
  options?: PlanOptionDto[];
}

/** The value an option field takes inside one specific plan. */
export interface PlanOptionValueDto {
  id: string;
  optionFieldId: string;
  /** Convenience copies of the field definition, so the UI can render directly. */
  fieldKey: string;
  fieldLabel: string;
  dataType: OptionFieldDataType;
  unit: string | null;
  /** Typed according to `dataType`. `null` means "not configured". */
  value: number | string | boolean | null;
}

/** An option attached to ONE configuration, with its values and position. */
export interface PlanOptionDto {
  id: string;
  planConfigurationId: string;
  optionId: string;
  optionName: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  values: PlanOptionValueDto[];
}

/** Payload for writing one option field value inside a plan. */
export interface PlanOptionValueInput {
  optionFieldId: string;
  value: number | string | boolean | null;
}
