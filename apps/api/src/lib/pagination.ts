import type { Paginated } from '@aggregator/shared';
import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

/** Query parameters every list endpoint accepts. */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().min(1).optional(),
  /** Omitted = every record; `true`/`false` filters on the soft-delete flag. */
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function toSkipTake(query: Pick<ListQuery, 'page' | 'pageSize'>) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function paginate<T>(
  items: T[],
  total: number,
  query: Pick<ListQuery, 'page' | 'pageSize'>,
): Paginated<T> {
  return { items, total, page: query.page, pageSize: query.pageSize };
}

/** `{ isActive: true }` when the filter was supplied, otherwise no filter. */
export function activeFilter(isActive: boolean | undefined) {
  return isActive === undefined ? {} : { isActive };
}
