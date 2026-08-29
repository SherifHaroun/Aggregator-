/**
 * The provider networks one insurance company sells.
 *
 * A network is NOT a benefit. "Golden Care Network" is not something a plan
 * covers — it is the estate of hospitals and clinics the company gives access
 * to, and every plan that company offers is sold on one of them. Held as a
 * benefit it had to be re-typed on every plan of every company, and there was
 * nowhere to say that a company ranks one of its own networks above another.
 *
 * `sortOrder` is that ranking, best first. Nothing here is seeded: every
 * network is a record an employee created against a real company.
 */

import type { CompanyMedicalNetworkDto } from '@aggregator/shared';
import type { CompanyMedicalNetwork } from '@prisma/client';
import { toIso } from '../../lib/decimal.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { applyOrder, nextSortOrder } from '../../lib/ordering.js';
import { getPrisma } from '../../lib/prisma.js';
import type {
  CreateMedicalNetworkInput,
  UpdateMedicalNetworkInput,
} from './companies.schemas.js';

type NetworkWithUsage = CompanyMedicalNetwork & { _count?: { plans: number } };

export function toMedicalNetworkDto(network: NetworkWithUsage): CompanyMedicalNetworkDto {
  return {
    id: network.id,
    companyId: network.companyId,
    name: network.name,
    description: network.description,
    sortOrder: network.sortOrder,
    isActive: network.isActive,
    createdAt: toIso(network.createdAt),
    updatedAt: toIso(network.updatedAt),
    ...(network._count ? { planCount: network._count.plans } : {}),
  };
}

/** Read with the number of plans sold on each network. */
const withUsage = { _count: { select: { plans: true } } } as const;

/** Include clause for a company read with its networks, in its own order. */
export const networksInclude = {
  medicalNetworks: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' as const },
    include: withUsage,
  },
} as const;

export async function listMedicalNetworks(
  companyId: string,
): Promise<CompanyMedicalNetworkDto[]> {
  const company = await getPrisma().company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw notFound('Company');

  const networks = await getPrisma().companyMedicalNetwork.findMany({
    where: { companyId, isActive: true },
    include: withUsage,
    orderBy: { sortOrder: 'asc' },
  });
  return networks.map(toMedicalNetworkDto);
}

/**
 * Add a network, at the END of the company's list.
 *
 * The end rather than the top because position is the company's own ranking: a
 * new network silently landing above the best one would restate what the
 * company offers. The employee drags it where it belongs.
 */
export async function createMedicalNetwork(
  companyId: string,
  input: CreateMedicalNetworkInput,
): Promise<CompanyMedicalNetworkDto> {
  const prisma = getPrisma();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw notFound('Company');

  const clash = await prisma.companyMedicalNetwork.findFirst({
    where: { companyId, name: { equals: input.name, mode: 'insensitive' } },
    select: { name: true },
  });
  if (clash) {
    throw conflict(`This company already has a network called "${clash.name}".`, {
      name: ['This network already exists.'],
    });
  }

  const network = await prisma.companyMedicalNetwork.create({
    data: {
      companyId,
      ...input,
      sortOrder: nextSortOrder(
        await prisma.companyMedicalNetwork.aggregate({
          where: { companyId },
          _max: { sortOrder: true },
        }),
      ),
    },
    include: withUsage,
  });
  return toMedicalNetworkDto(network);
}

export async function updateMedicalNetwork(
  networkId: string,
  input: UpdateMedicalNetworkInput,
): Promise<CompanyMedicalNetworkDto> {
  const prisma = getPrisma();

  const existing = await prisma.companyMedicalNetwork.findUnique({ where: { id: networkId } });
  if (!existing) throw notFound('Medical network');

  if (input.name !== undefined && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const clash = await prisma.companyMedicalNetwork.findFirst({
      where: {
        companyId: existing.companyId,
        id: { not: networkId },
        name: { equals: input.name, mode: 'insensitive' },
      },
      select: { name: true },
    });
    if (clash) {
      throw conflict(`This company already has a network called "${clash.name}".`, {
        name: ['This network already exists.'],
      });
    }
  }

  /**
   * Renaming is safe at any time: a plan points at the row, never at its
   * wording, so correcting a spelling reaches every plan sold on it at once.
   */
  const network = await prisma.companyMedicalNetwork.update({
    where: { id: networkId },
    data: input,
    include: withUsage,
  });
  return toMedicalNetworkDto(network);
}

/** Put one company's networks in the order it ranks them, best first. */
export async function reorderMedicalNetworks(
  companyId: string,
  orderedIds: string[],
): Promise<void> {
  const prisma = getPrisma();

  const owned = await prisma.companyMedicalNetwork.count({
    where: { companyId, id: { in: orderedIds } },
  });
  if (owned !== orderedIds.length) {
    throw badRequest('The list contains networks that do not belong to this company.');
  }

  await prisma.$transaction(async (tx) => {
    await applyOrder(tx, 'company_medical_networks', orderedIds);
  });
}

/**
 * Remove a network.
 *
 * Refused by default while plans are sold on it. Deleting it does not delete
 * those plans — they simply stop naming a network, which then reads as "not
 * stated" — but that is a real change to what they say, so it is put to the
 * employee first rather than happening quietly.
 */
export async function deleteMedicalNetwork(
  networkId: string,
  { force = false } = {},
): Promise<void> {
  const prisma = getPrisma();

  const network = await prisma.companyMedicalNetwork.findUnique({
    where: { id: networkId },
    include: withUsage,
  });
  if (!network) throw notFound('Medical network');

  const usage = network._count.plans;
  if (usage > 0 && !force) {
    throw conflict(
      `${usage} ${usage === 1 ? 'plan is' : 'plans are'} sold on "${network.name}". Deleting it leaves ${usage === 1 ? 'that plan' : 'those plans'} with no network stated. Rename it instead, or confirm to remove it anyway.`,
      { planCount: [String(usage)] },
    );
  }

  await prisma.companyMedicalNetwork.delete({ where: { id: networkId } });
}

/**
 * Check that a plan's chosen network belongs to the plan's own company.
 *
 * A plan sold on another company's network is not a typo to be tidied later —
 * it is a false statement about what the customer gets, so it is refused.
 */
export async function assertNetworkBelongsToCompany(
  companyId: string,
  medicalNetworkId: string | null | undefined,
): Promise<void> {
  if (!medicalNetworkId) return;

  const network = await getPrisma().companyMedicalNetwork.findFirst({
    where: { id: medicalNetworkId, companyId },
    select: { id: true },
  });
  if (!network) {
    throw badRequest('That network belongs to a different company.', {
      medicalNetworkId: ['Choose one of this company’s own networks.'],
    });
  }
}
