import type { Prisma } from '@prisma/client';

/** Anything Prisma may hand back for a `Decimal` column, or that we write to one. */
export type DecimalLike = Prisma.Decimal | number | string;

/**
 * Prisma `Decimal` -> plain number for JSON responses.
 *
 * Insurance amounts are far inside double precision, and a plain number keeps
 * the frontend simple. Accepts the plain `number` and `string` forms Prisma can
 * also produce, so callers never have to know which representation they hold.
 */
export function toNumber(value: DecimalLike | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return value.toNumber();
}

/** ISO timestamp for JSON responses. */
export function toIso(value: Date): string {
  return value.toISOString();
}
