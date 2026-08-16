/**
 * Shared reordering logic for every sortable list (option catalogue, option
 * fields, options inside a plan). Written once so drag-and-drop behaves
 * identically everywhere.
 */

import { z } from 'zod';

export const reorderSchema = z.object({
  /** Every id of the list, in the new order. Position becomes `sortOrder`. */
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** The subset of a Prisma delegate this helper needs. */
interface SortableDelegate {
  update(args: { where: { id: string }; data: { sortOrder: number } }): Promise<unknown>;
}

/** Assign `sortOrder = index` following `orderedIds`. Run inside a transaction. */
export async function applyOrder(delegate: SortableDelegate, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) => delegate.update({ where: { id }, data: { sortOrder: index } })),
  );
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
