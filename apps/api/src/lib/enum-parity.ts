/**
 * Compile-time guard binding the Prisma enums to the centralized business
 * configuration in `@aggregator/shared`.
 *
 * Customer types and geographical coverage are application configuration, not
 * insurance data, so `@aggregator/shared` is their single source of truth. They
 * are ALSO Prisma enums, so PostgreSQL rejects an invalid value outright.
 *
 * That means the list exists in two places, which is exactly the kind of
 * duplication that silently drifts. The assertions below make drift a BUILD
 * FAILURE: adding, renaming or removing a value on one side without the other
 * stops compiling. Adding a value therefore means editing the shared config,
 * the Prisma enum, and generating a migration — together, or not at all.
 *
 * This file is types only; it emits no runtime code.
 */

import type { CustomerTypeId, GeographicalCoverageId } from '@aggregator/shared';
import type { $Enums } from '@prisma/client';

/** Resolves to `true` only when the two unions have exactly the same members. */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

/** Fails to compile if `CustomerType` and `CUSTOMER_TYPES` disagree. */
export type CustomerTypeParity = MutuallyAssignable<CustomerTypeId, $Enums.CustomerType>;

/** Fails to compile if `GeographicalCoverage` and `GEOGRAPHICAL_COVERAGES` disagree. */
export type GeographicalCoverageParity = MutuallyAssignable<
  GeographicalCoverageId,
  $Enums.GeographicalCoverage
>;

// Instantiating the aliases is what triggers the check.
const _customerTypeParity: CustomerTypeParity = true;
const _geographicalCoverageParity: GeographicalCoverageParity = true;

void _customerTypeParity;
void _geographicalCoverageParity;
