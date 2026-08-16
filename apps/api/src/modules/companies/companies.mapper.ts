import type { CompanyDto } from '@aggregator/shared';
import type { Company } from '@prisma/client';
import { toIso } from '../../lib/decimal.js';

export function toCompanyDto(company: Company): CompanyDto {
  return {
    id: company.id,
    name: company.name,
    shortName: company.shortName,
    logoUrl: company.logoUrl,
    description: company.description,
    website: company.website,
    email: company.email,
    phone: company.phone,
    mobile: company.mobile,
    address: company.address,
    isActive: company.isActive,
    createdAt: toIso(company.createdAt),
    updatedAt: toIso(company.updatedAt),
  };
}
