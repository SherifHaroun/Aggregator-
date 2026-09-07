/**
 * THE SHARED LIST OF MEDICAL NETWORKS, and the provider list each one carries.
 *
 * A network is the estate of hospitals, clinics and pharmacies a plan gives
 * access to — GlobeMed, AXA's provider network — and it is GLOBAL: GlobeMed is
 * one network however many insurers sell on it. Held per company it was the
 * same estate entered five times with five files to keep current.
 *
 * The provider list is the insurer's own spreadsheet, kept exactly as sent.
 * Every insurer lays it out differently and reissues it every few months, so
 * nothing here reads the file; it is stored, replaced whole, and served from a
 * STABLE address keyed on the network — which is what lets a PDF issued last
 * month open the file that is current today.
 *
 * Nothing is seeded. Every network is a record an employee created.
 */

import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PROVIDER_LIST_HISTORY_LIMIT, type MedicalNetworkDto } from '@aggregator/shared';
import type { MedicalNetwork, MedicalNetworkProviderList } from '@prisma/client';
import { env } from '../../config/env.js';
import { toIso } from '../../lib/decimal.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { applyOrder, nextSortOrder } from '../../lib/ordering.js';
import { getPrisma } from '../../lib/prisma.js';
import type {
  CreateMedicalNetworkInput,
  UpdateMedicalNetworkInput,
} from './medical-networks.schemas.js';

type NetworkWithUsage = MedicalNetwork & {
  _count?: { plans: number };
  providerLists?: MedicalNetworkProviderList[];
};

export function toMedicalNetworkDto(network: NetworkWithUsage): MedicalNetworkDto {
  return {
    id: network.id,
    name: network.name,
    description: network.description,
    sortOrder: network.sortOrder,
    isActive: network.isActive,
    providerListUrl: network.providerListUrl,
    providerListFileName: network.providerListFileName,
    providerListUpdatedAt:
      network.providerListUpdatedAt === null ? null : toIso(network.providerListUpdatedAt),
    createdAt: toIso(network.createdAt),
    updatedAt: toIso(network.updatedAt),
    /** How many PLANS are sold on it — the thing deleting it would unsettle. */
    ...(network._count ? { planCount: network._count.plans } : {}),
    /** Every file ever uploaded, newest first, with the current one marked. */
    ...(network.providerLists
      ? {
          providerListHistory: network.providerLists.map((version) => ({
            id: version.id,
            fileName: version.fileName,
            uploadedAt: toIso(version.uploadedAt),
            sizeBytes: version.sizeBytes,
            isCurrent: version.storedUrl === network.providerListUrl,
          })),
        }
      : {}),
  };
}

/** Read with the number of plans sold on each network, and its file history. */
const withUsage = {
  _count: { select: { plans: true } },
  providerLists: { orderBy: { uploadedAt: 'desc' as const } },
} as const;

export async function listMedicalNetworks({
  includeInactive = false,
}: { includeInactive?: boolean } = {}): Promise<MedicalNetworkDto[]> {
  const networks = await getPrisma().medicalNetwork.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: withUsage,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return networks.map(toMedicalNetworkDto);
}

export async function getMedicalNetwork(id: string): Promise<MedicalNetworkDto> {
  const network = await getPrisma().medicalNetwork.findUnique({
    where: { id },
    include: withUsage,
  });
  if (!network) throw notFound('Medical network');
  return toMedicalNetworkDto(network);
}

/** Refuse a name the list already carries, whatever its case. */
async function assertNameIsFree(name: string, excludeId?: string): Promise<void> {
  const clash = await getPrisma().medicalNetwork.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { name: true },
  });
  if (clash) {
    throw conflict(`A network called "${clash.name}" already exists.`, {
      name: ['This network already exists.'],
    });
  }
}

/**
 * Add a network, at the END of the list.
 *
 * The end rather than the top, because position is the order plans are
 * offered the list in — best first — and a new network nobody has placed yet
 * should not land above the ones that were. The employee drags it into place.
 */
export async function createMedicalNetwork(
  input: CreateMedicalNetworkInput,
): Promise<MedicalNetworkDto> {
  const prisma = getPrisma();
  await assertNameIsFree(input.name);

  const network = await prisma.medicalNetwork.create({
    data: {
      ...input,
      sortOrder: nextSortOrder(
        await prisma.medicalNetwork.aggregate({ _max: { sortOrder: true } }),
      ),
    },
    include: withUsage,
  });
  return toMedicalNetworkDto(network);
}

/**
 * Rename, describe or retire a network.
 *
 * Renaming is safe at any time: a plan points at the row, never at its
 * wording, so correcting a spelling reaches every plan sold on it and every
 * PDF generated from then on.
 */
export async function updateMedicalNetwork(
  id: string,
  input: UpdateMedicalNetworkInput,
): Promise<MedicalNetworkDto> {
  const prisma = getPrisma();
  const existing = await prisma.medicalNetwork.findUnique({ where: { id } });
  if (!existing) throw notFound('Medical network');

  if (input.name !== undefined && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameIsFree(input.name, id);
  }

  const network = await prisma.medicalNetwork.update({
    where: { id },
    data: input,
    include: withUsage,
  });
  return toMedicalNetworkDto(network);
}

/** Put the list in the order it should be offered, best first. */
export async function reorderMedicalNetworks(orderedIds: string[]): Promise<void> {
  const prisma = getPrisma();
  const known = await prisma.medicalNetwork.count({ where: { id: { in: orderedIds } } });
  if (known !== orderedIds.length) {
    throw badRequest('The list contains networks that do not exist.');
  }
  await prisma.$transaction(async (tx) => {
    await applyOrder(tx, 'medical_networks', orderedIds);
  });
}

/**
 * Remove a network.
 *
 * Refused by default while plans are sold on it. Deleting it does not delete
 * those plans — they simply stop naming a network, which then reads as "not
 * stated" — but that is a real change to what they tell a customer, so it is
 * put to the employee first rather than happening quietly.
 *
 * The stored file goes with it: nothing would be able to reach it any more.
 */
export async function deleteMedicalNetwork(id: string, { force = false } = {}): Promise<void> {
  const prisma = getPrisma();
  const network = await prisma.medicalNetwork.findUnique({ where: { id }, include: withUsage });
  if (!network) throw notFound('Medical network');

  const usage = network._count.plans;
  if (usage > 0 && !force) {
    throw conflict(
      `${usage} ${usage === 1 ? 'plan is' : 'plans are'} sold on "${network.name}". Deleting it leaves ${usage === 1 ? 'that plan' : 'those plans'} with no network stated. Rename it instead, or confirm to remove it anyway.`,
      { planCount: [String(usage)] },
    );
  }

  await prisma.medicalNetwork.delete({ where: { id } });
  // Every file it ever held goes with it: nothing can reach them any more.
  for (const version of network.providerLists) await discardStoredFile(version.storedUrl);
}

/**
 * Check that a plan's chosen network exists and is still offered.
 *
 * A plan on a retired network is not refused: retiring hides a network from
 * the list new plans choose from, and the plans already on it keep saying
 * what they said. A plan on a network that does not exist is a false
 * statement and is refused.
 */
export async function assertMedicalNetworkExists(
  medicalNetworkId: string | null | undefined,
): Promise<void> {
  if (!medicalNetworkId) return;
  const network = await getPrisma().medicalNetwork.findUnique({
    where: { id: medicalNetworkId },
    select: { id: true },
  });
  if (!network) {
    throw badRequest('That medical network does not exist.', {
      medicalNetworkId: ['Choose a network from the list.'],
    });
  }
}

// ---------------------------------------------------------------------------
// The provider list
// ---------------------------------------------------------------------------

/** Where a stored `/uploads/...` path lives on disk, or `null` for anything else. */
function storedFilePath(url: string | null): string | null {
  if (!url || !url.startsWith(`${env.uploadPublicPath}/`)) return null;
  // The basename only: a stored path can never point outside the upload
  // directory, whatever it says.
  const name = basename(url);
  return name ? join(env.uploadDir, name) : null;
}

/** Best effort: a file that is already gone is the outcome wanted anyway. */
async function discardStoredFile(url: string | null): Promise<void> {
  const path = storedFilePath(url);
  if (!path) return;
  try {
    await unlink(path);
  } catch {
    // Already removed, or never written. Either way nothing is left to reach.
  }
}

/**
 * Record a newly uploaded provider list as the network's current one.
 *
 * REPLACES WHOLE, KEEPS THE OLD ONE. The insurer publishes a complete list each
 * time, so there is nothing to merge — but the file it replaces stays in the
 * network's history, because "what was the list in May?" is a question that
 * gets asked. Everything that points at the network — every plan, and every PDF
 * already in a customer's hands — now resolves to the new file, because they
 * all point at the network rather than at a file.
 */
export async function setProviderList(
  id: string,
  file: { storedUrl: string; originalName: string; sizeBytes: number },
): Promise<MedicalNetworkDto> {
  const prisma = getPrisma();
  const existing = await prisma.medicalNetwork.findUnique({ where: { id } });
  if (!existing) {
    // The upload has already landed on disk; do not leave it orphaned.
    await discardStoredFile(file.storedUrl);
    throw notFound('Medical network');
  }

  const uploadedAt = new Date();
  const network = await prisma.medicalNetwork.update({
    where: { id },
    data: {
      providerListUrl: file.storedUrl,
      providerListFileName: file.originalName,
      providerListUpdatedAt: uploadedAt,
      providerLists: {
        create: {
          storedUrl: file.storedUrl,
          fileName: file.originalName,
          sizeBytes: file.sizeBytes,
          uploadedAt,
        },
      },
    },
    include: withUsage,
  });

  /**
   * THE HISTORY IS SHORT ON PURPOSE. The newest few answer "what changed since
   * the last issue?"; anything older is an archive nobody asked for, and
   * every file kept is a file on the volume. Older issues go, files and all.
   */
  const stale = (network.providerLists ?? []).slice(PROVIDER_LIST_HISTORY_LIMIT);
  if (stale.length > 0) {
    await prisma.medicalNetworkProviderList.deleteMany({
      where: { id: { in: stale.map((version) => version.id) } },
    });
    for (const version of stale) await discardStoredFile(version.storedUrl);
  }

  return toMedicalNetworkDto(
    await prisma.medicalNetwork.findUniqueOrThrow({ where: { id }, include: withUsage }),
  );
}

/**
 * Drop one PAST issue from the history. The current file is not deletable
 * this way — take it off the network with `clearProviderList`, which keeps it
 * in the history, or replace it.
 */
export async function deleteProviderListVersion(
  networkId: string,
  versionId: string,
): Promise<MedicalNetworkDto> {
  const prisma = getPrisma();
  const network = await prisma.medicalNetwork.findUnique({ where: { id: networkId } });
  if (!network) throw notFound('Medical network');
  const version = await prisma.medicalNetworkProviderList.findFirst({
    where: { id: versionId, networkId },
  });
  if (!version) throw notFound('Provider list');
  if (version.storedUrl === network.providerListUrl) {
    throw conflict(
      'This is the current provider list. Replace it or remove it from the network first.',
    );
  }

  await prisma.medicalNetworkProviderList.delete({ where: { id: versionId } });
  await discardStoredFile(version.storedUrl);
  return getMedicalNetwork(networkId);
}

/**
 * Take the provider list off a network, leaving the network — and its history —
 * in place. The file stays reachable as a past issue.
 */
export async function clearProviderList(id: string): Promise<MedicalNetworkDto> {
  const prisma = getPrisma();
  const existing = await prisma.medicalNetwork.findUnique({ where: { id } });
  if (!existing) throw notFound('Medical network');

  const network = await prisma.medicalNetwork.update({
    where: { id },
    data: { providerListUrl: null, providerListFileName: null, providerListUpdatedAt: null },
    include: withUsage,
  });
  return toMedicalNetworkDto(network);
}

/** One PAST issue of the list, for somebody asking what it said back then. */
export async function resolveProviderListVersion(
  networkId: string,
  versionId: string,
): Promise<{ path: string; fileName: string }> {
  const version = await getPrisma().medicalNetworkProviderList.findFirst({
    where: { id: versionId, networkId },
    select: { storedUrl: true, fileName: true },
  });
  if (!version) throw notFound('Provider list');

  const path = storedFilePath(version.storedUrl);
  if (!path) throw notFound('Provider list');
  return { path, fileName: version.fileName };
}

/**
 * The current provider list, as a file to send.
 *
 * This is what the stable address resolves to. Answered for a retired network
 * too: a customer holding an older PDF still deserves the list it promised.
 */
export async function resolveProviderList(id: string): Promise<{ path: string; fileName: string }> {
  const network = await getPrisma().medicalNetwork.findUnique({
    where: { id },
    select: { name: true, providerListUrl: true, providerListFileName: true },
  });
  if (!network) throw notFound('Medical network');

  const path = storedFilePath(network.providerListUrl);
  if (!path) throw notFound('Provider list');

  return {
    path,
    fileName: network.providerListFileName ?? `${network.name} provider list`,
  };
}
