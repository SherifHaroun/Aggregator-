/**
 * Shared reordering logic for every sortable list (option catalogue, option
 * fields, options inside a plan). Written once so drag-and-drop behaves
 * identically everywhere.
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const reorderSchema = z.object({
  /** Every id of the list, in the new order. Position becomes `sortOrder`. */
  orderedIds: z.array(z.string().min(1)).min(1),
});

/**
 * The tables that carry a `sortOrder`.
 *
 * A closed list, and the ONLY thing interpolated into the statement below.
 * Table names come from this union — never from a request — which is what makes
 * the raw query safe.
 */
export type SortableTable =
  | 'insurance_options'
  | 'option_fields'
  | 'option_choices'
  | 'plan_options'
  | 'company_medical_networks';

/** The subset of a Prisma client this helper needs. */
interface RawClient {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

/**
 * Assign `sortOrder = index` following `orderedIds`.
 *
 * ONE statement, whatever the list's length. An UPDATE per row looks harmless
 * on a list of five and is fatal on a list of thirty: each is a round trip to
 * the database, and against a hosted Postgres thirty of them run past Prisma's
 * five-second interactive-transaction timeout — the reorder then fails with the
 * list half-written. `unnest ... WITH ORDINALITY` turns the whole new order
 * into a single UPDATE, so cost stays flat and the write is atomic by itself.
 *
 * Ids that do not belong to the caller's list simply match nothing; every
 * caller checks ownership before getting here.
 */
export async function applyOrder(
  client: RawClient,
  table: SortableTable,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return;

  await client.$executeRaw`
    UPDATE ${Prisma.raw(`"${table}"`)} AS t
    SET "sortOrder" = ordered.position - 1
    FROM unnest(${orderedIds}::text[]) WITH ORDINALITY AS ordered(id, position)
    WHERE t.id = ordered.id
  `;
}

/**
 * Next free position at the end of a list.
 *
 * Takes the result of `delegate.aggregate({ where, _max: { sortOrder: true } })`
 * rather than the delegate itself, so Prisma keeps inferring the exact result
 * type at the call site.
 */
export function nextSortOrder(aggregate: { _max: { sortOrder: number | null } }): number {
  return (aggregate._max.sortOrder ?? -1) + 1;
}
