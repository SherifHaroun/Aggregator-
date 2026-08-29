import type { CompanyDto } from '@aggregator/shared';
import type { Company, CompanyMedicalNetwork } from '@prisma/client';
import { toMedicalNetworkDto } from './medical-networks.service.js';
import { toIso } from '../../lib/decimal.js';

export function toCompanyDto(
  company: Company & { medicalNetworks?: CompanyMedicalNetwork[] },
): CompanyDto {
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
    // The networks it sells, in its own ranking, when they were read with it.
    ...(company.medicalNetworks
      ? { medicalNetworks: company.medicalNetworks.map(toMedicalNetworkDto) }
      : {}),
  };
}
