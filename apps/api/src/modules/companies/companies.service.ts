import type { CompanyDto, Paginated } from '@aggregator/shared';
import { inUse, notFound } from '../../lib/errors.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
import { toCompanyDto } from './companies.mapper.js';
import type { CreateCompanyInput, UpdateCompanyInput } from './companies.schemas.js';

export async function listCompanies(query: ListQuery): Promise<Paginated<CompanyDto>> {
  const prisma = getPrisma();
  const where = {
    ...activeFilter(query.isActive),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { shortName: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.company.findMany({ where, orderBy: { name: 'asc' }, ...toSkipTake(query) }),
    prisma.company.count({ where }),
  ]);

  return paginate(items.map(toCompanyDto), total, query);
}

export async function getCompany(id: string): Promise<CompanyDto> {
  const company = await getPrisma().company.findUnique({ where: { id } });
  if (!company) throw notFound('Company');
  return toCompanyDto(company);
}

export async function createCompany(input: CreateCompanyInput): Promise<CompanyDto> {
  const company = await getPrisma().company.create({ data: input });
  return toCompanyDto(company);
}

export async function updateCompany(id: string, input: UpdateCompanyInput): Promise<CompanyDto> {
  const company = await getPrisma().company.update({ where: { id }, data: input });
  return toCompanyDto(company);
}

/**
 * Permanent delete, allowed only while the company has no plans.
 * Once plans exist the company is part of the historical record — the caller
 * should deactivate it (`PATCH { isActive: false }`) instead.
 */
export async function deleteCompany(id: string): Promise<void> {
  const prisma = getPrisma();
  const planCount = await prisma.plan.count({ where: { companyId: id } });
  if (planCount > 0) throw inUse('company', `${planCount} plan(s)`);
  await prisma.company.delete({ where: { id } });
}
