import type { InsuranceTypeDto, Paginated } from '@aggregator/shared';
import type { InsuranceType } from '@prisma/client';
import { toIso } from '../../lib/decimal.js';
import { conflict, notFound } from '../../lib/errors.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
import { toRecordKey } from '../../lib/record-key.js';
import type {
  CreateInsuranceTypeInput,
  UpdateInsuranceTypeInput,
} from './insurance-types.schemas.js';

export function toInsuranceTypeDto(type: InsuranceType): InsuranceTypeDto {
  return {
    id: type.id,
    name: type.name,
    code: type.code,
    description: type.description,
    sortOrder: type.sortOrder,
    isActive: type.isActive,
    createdAt: toIso(type.createdAt),
    updatedAt: toIso(type.updatedAt),
  };
}

export async function listInsuranceTypes(query: ListQuery): Promise<Paginated<InsuranceTypeDto>> {
  const prisma = getPrisma();
  const where = {
    ...activeFilter(query.isActive),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.insuranceType.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      ...toSkipTake(query),
    }),
    prisma.insuranceType.count({ where }),
  ]);

  return paginate(items.map(toInsuranceTypeDto), total, query);
}

export async function getInsuranceType(id: string): Promise<InsuranceTypeDto> {
  const type = await getPrisma().insuranceType.findUnique({ where: { id } });
  if (!type) throw notFound('Insurance type');
  return toInsuranceTypeDto(type);
}

export async function createInsuranceType(
  input: CreateInsuranceTypeInput,
): Promise<InsuranceTypeDto> {
  const { code, ...rest } = input;
  const type = await getPrisma().insuranceType.create({
    data: { ...rest, code: code ?? toRecordKey(input.name) },
  });
  return toInsuranceTypeDto(type);
}

export async function updateInsuranceType(
  id: string,
  input: UpdateInsuranceTypeInput,
): Promise<InsuranceTypeDto> {
  const type = await getPrisma().insuranceType.update({ where: { id }, data: input });
  return toInsuranceTypeDto(type);
}

/**
 * Permanent delete, allowed only while nothing references the type.
 * Options and plans both hang off an insurance type, so in practice an
 * established type is deactivated rather than deleted.
 */
export async function deleteInsuranceType(id: string): Promise<void> {
  const prisma = getPrisma();
  const [planCount, optionCount] = await Promise.all([
    prisma.plan.count({ where: { insuranceTypeId: id } }),
    prisma.insuranceOption.count({ where: { insuranceTypeId: id } }),
  ]);

  if (planCount > 0 || optionCount > 0) {
    throw conflict(
      `This insurance type is used by ${planCount} plan(s) and ${optionCount} option(s) and cannot be deleted. Deactivate it instead.`,
    );
  }
  await prisma.insuranceType.delete({ where: { id } });
}
