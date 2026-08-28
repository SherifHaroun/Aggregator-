/**
 * The catalogue of qualifications a benefit can carry.
 *
 * Global, exactly like the benefit catalogue: "in-network only" is defined once
 * and offered to every plan of every company. What differs between plans is
 * WHICH of them they impose, and that is written by
 * `plan-options.service#setPlanOptionLimitations`.
 *
 * Nothing here is seeded. Every limitation is a record an employee created.
 */

import {
  BENEFIT_LIMITATION_MAX,
  type LimitationDto,
  type Paginated,
} from '@aggregator/shared';
import type { Limitation, Prisma } from '@prisma/client';
import { toIso, toNumber } from '../../lib/decimal.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { nextSortOrder } from '../../lib/ordering.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
import type { CreateLimitationInput, UpdateLimitationInput } from './limitations.schemas.js';

type LimitationWithUsage = Limitation & { _count?: { planOptions: number } };

export function toLimitationDto(limitation: LimitationWithUsage): LimitationDto {
  return {
    id: limitation.id,
    name: limitation.name,
    description: limitation.description,
    scope: limitation.scope,
    // A Decimal column: always a real number on the wire, never a string.
    restrictionWeight: toNumber(limitation.restrictionWeight) ?? 0,
    sortOrder: limitation.sortOrder,
    isActive: limitation.isActive,
    createdAt: toIso(limitation.createdAt),
    updatedAt: toIso(limitation.updatedAt),
    ...(limitation._count ? { usageCount: limitation._count.planOptions } : {}),
  };
}

/** Read with the number of plan benefits currently carrying it. */
const withUsage = { _count: { select: { planOptions: true } } } as const;

export async function listLimitations(
  query: ListQuery & { scope?: LimitationDto['scope'] },
): Promise<Paginated<LimitationDto>> {
  const prisma = getPrisma();
  const where: Prisma.LimitationWhereInput = {
    ...activeFilter(query.isActive),
    ...(query.scope ? { scope: query.scope } : {}),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.limitation.findMany({
      where,
      include: withUsage,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      ...toSkipTake(query),
    }),
    prisma.limitation.count({ where }),
  ]);

  return paginate(items.map(toLimitationDto), total, query);
}

export async function getLimitation(id: string): Promise<LimitationDto> {
  const limitation = await getPrisma().limitation.findUnique({ where: { id }, include: withUsage });
  if (!limitation) throw notFound('Limitation');
  return toLimitationDto(limitation);
}

/**
 * Create a limitation.
 *
 * Placed at the END of its list rather than left at `0`, for the same reason
 * insurance types are: every record sharing one position makes the list fall
 * back to alphabetical order, which is not the order anybody entered them in.
 */
export async function createLimitation(input: CreateLimitationInput): Promise<LimitationDto> {
  const prisma = getPrisma();
  const { sortOrder, ...rest } = input;

  await refuseDuplicateName(input.name, input.scope ?? 'VALUE');

  const position =
    sortOrder ?? nextSortOrder(await prisma.limitation.aggregate({ _max: { sortOrder: true } }));

  const limitation = await prisma.limitation.create({
    data: { ...rest, sortOrder: position },
    include: withUsage,
  });
  return toLimitationDto(limitation);
}

export async function updateLimitation(
  id: string,
  input: UpdateLimitationInput,
): Promise<LimitationDto> {
  const prisma = getPrisma();

  const existing = await prisma.limitation.findUnique({
    where: { id },
    select: { name: true, scope: true },
  });
  if (!existing) throw notFound('Limitation');

  const name = input.name ?? existing.name;
  const scope = input.scope ?? existing.scope;
  const moved = name.toLowerCase() !== existing.name.toLowerCase() || scope !== existing.scope;
  if (moved) await refuseDuplicateName(name, scope);

  const limitation = await prisma.limitation.update({
    where: { id },
    data: input,
    include: withUsage,
  });
  return toLimitationDto(limitation);
}

/**
 * Delete a limitation, but only while nothing imposes it.
 *
 * A limitation in use is describing real cover on real plans. Deleting it would
 * silently make every one of those plans look UNRESTRICTED — the exact opposite
 * of what the record says — and would change comparison results with no trace.
 * Deactivating retires it from the pickers while the plans that already carry
 * it keep reading correctly.
 */
export async function deleteLimitation(id: string): Promise<void> {
  const prisma = getPrisma();

  const limitation = await prisma.limitation.findUnique({ where: { id }, include: withUsage });
  if (!limitation) throw notFound('Limitation');

  const usage = limitation._count.planOptions;
  if (usage > 0) {
    throw conflict(
      `This limitation is recorded on ${usage} plan ${usage === 1 ? 'benefit' : 'benefits'} and cannot be deleted. Deactivate it instead, or remove it from those benefits first.`,
    );
  }

  await prisma.limitation.delete({ where: { id } });
}

/**
 * Replace the limitations carried by one benefit on one configuration.
 *
 * Validated as a set: unknown ids, deactivated entries and duplicates are all
 * refused outright rather than silently dropped, because a half-written set
 * would misstate the cover — and misstating cover is the one thing this whole
 * feature exists to stop.
 */
export async function resolveLimitationsForPlanOption(limitationIds: string[]): Promise<string[]> {
  const unique = [...new Set(limitationIds)];

  if (unique.length !== limitationIds.length) {
    throw badRequest('The same limitation was supplied more than once.');
  }
  if (unique.length > BENEFIT_LIMITATION_MAX) {
    throw badRequest(`A benefit may carry at most ${BENEFIT_LIMITATION_MAX} limitations.`);
  }
  if (unique.length === 0) return [];

  const found = await getPrisma().limitation.findMany({
    where: { id: { in: unique } },
    select: { id: true, isActive: true },
  });

  if (found.length !== unique.length) throw notFound('Limitation');

  const retired = found.filter((limitation) => !limitation.isActive);
  if (retired.length > 0) {
    throw conflict('A deactivated limitation cannot be added to a benefit.');
  }

  return unique;
}

/**
 * Names are unique without regard to case, as benefit names are — but only
 * within one scope, because the two lists are separate vocabularies.
 */
async function refuseDuplicateName(name: string, scope: LimitationDto['scope']): Promise<void> {
  const clash = await getPrisma().limitation.findFirst({
    where: { scope, name: { equals: name, mode: 'insensitive' } },
    select: { name: true },
  });
  if (clash) {
    throw conflict(`A limitation named "${clash.name}" already exists.`, {
      name: ['This limitation already exists.'],
    });
  }
}
