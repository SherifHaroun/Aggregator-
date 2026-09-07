/**
 * The shared list of medical networks, against a real PostgreSQL database.
 *
 * Three rules matter.
 *
 * ONE LIST: GlobeMed is one network however many insurers sell on it, so the
 * list belongs to no company and a plan of any company may name any entry.
 *
 * THE PLAN NAMES IT: every variant of a plan gives access to the same estate,
 * so the network sits on the plan and the variants say nothing about it.
 *
 * THE FILE IS REPLACED WHOLE, AT A STABLE ADDRESS: the insurer's spreadsheet is
 * kept as sent; a new one replaces it, the old one is discarded, and the
 * address a customer opens it from is keyed on the network — so it hands out
 * whatever file is current.
 *
 * OPT-IN, like the other database suites: runs only when `TEST_DATABASE_URL` is
 * set. Every record is namespaced and removed afterwards — test fixtures, not
 * seed data.
 */

import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import {
  clearProviderList,
  createMedicalNetwork,
  deleteMedicalNetwork,
  deleteProviderListVersion,
  getMedicalNetwork,
  listMedicalNetworks,
  reorderMedicalNetworks,
  resolveProviderList,
  resolveProviderListVersion,
  setProviderList,
  updateMedicalNetwork,
} from '../src/modules/medical-networks/medical-networks.service.js';
import { createPlanConfiguration } from '../src/modules/plan-configurations/plan-configurations.service.js';
import { createPlan, getPlan, updatePlan } from '../src/modules/plans/plans.service.js';

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

const PREFIX = `test_networks_${Date.now()}`;
const db = () => {
  if (!prisma) throw new Error('TEST_DATABASE_URL is not set.');
  return prisma;
};

let counter = 0;
const unique = () => `${PREFIX}_${(counter += 1)}`;

/** Two companies, so "shared by every company" is a claim with two sides. */
async function givenTwoCompanies() {
  const [a, b] = await Promise.all([
    db().company.create({ data: { name: unique() } }),
    db().company.create({ data: { name: unique() } }),
  ]);
  return { a: a.id, b: b.id };
}

/** A plan of one company, on a network or on none. */
async function givenPlanOn(companyId: string, medicalNetworkId: string | null) {
  const tag = unique();
  return createPlan({
    companyId,
    customerType: 'INDIVIDUAL',
    name: tag,
    code: tag,
    medicalNetworkId,
  });
}

/** A file on disk under the upload directory, as multer would leave it. */
async function givenUploadedFile(contents: string) {
  const name = `${unique()}.xlsx`;
  await writeFile(join(env.uploadDir, name), contents);
  return {
    storedUrl: `${env.uploadPublicPath}/${name}`,
    originalName: 'GlobeMed Network.xlsx',
    sizeBytes: contents.length,
  };
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

async function cleanup(): Promise<void> {
  if (!prisma) return;
  await prisma.plan.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.company.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.medicalNetwork.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

describe.skipIf(!url)('the shared medical networks', () => {
  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma?.$disconnect();
  });

  it('offers one list to every company, and lets each sell on any entry', async () => {
    const { a, b } = await givenTwoCompanies();
    const globemed = await createMedicalNetwork({ name: `${PREFIX} GlobeMed` });

    // Two insurers, one network: the whole reason the list is shared.
    const ofA = await givenPlanOn(a, globemed.id);
    const ofB = await givenPlanOn(b, globemed.id);

    expect(ofA.medicalNetworkId).toBe(globemed.id);
    expect(ofB.medicalNetworkId).toBe(globemed.id);
    expect((await getPlan(ofA.id)).medicalNetworkName).toBe(`${PREFIX} GlobeMed`);

    const listed = (await listMedicalNetworks()).find((n) => n.id === globemed.id);
    expect(listed?.planCount).toBe(2);
  });

  it('refuses a second network of the same name, whatever its case', async () => {
    await createMedicalNetwork({ name: `${PREFIX} GlobeMed` });
    await expect(createMedicalNetwork({ name: `${PREFIX} globemed` })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('refuses a plan on a network that does not exist', async () => {
    const { a } = await givenTwoCompanies();
    await expect(givenPlanOn(a, 'no_such_network')).rejects.toMatchObject({ status: 400 });
  });

  it('puts the network on the plan, and its variants say nothing about it', async () => {
    const { a } = await givenTwoCompanies();
    const globemed = await createMedicalNetwork({ name: `${PREFIX} GlobeMed` });
    const plan = await givenPlanOn(a, globemed.id);

    const variant = await createPlanConfiguration({
      planId: plan.id,
      geographicalCoverage: 'LOCAL',
    });
    expect(variant).not.toHaveProperty('medicalNetworkId');

    // Moving the plan moves every variant with it, because there is one fact.
    const axa = await createMedicalNetwork({ name: `${PREFIX} AXA` });
    const moved = await updatePlan(plan.id, { medicalNetworkId: axa.id });
    expect(moved.medicalNetworkName).toBe(`${PREFIX} AXA`);
  });

  it('ranks the list, and re-ranking changes no plan’s answer', async () => {
    const { a } = await givenTwoCompanies();
    const first = await createMedicalNetwork({ name: `${PREFIX} A` });
    const second = await createMedicalNetwork({ name: `${PREFIX} B` });
    const third = await createMedicalNetwork({ name: `${PREFIX} C` });
    const plan = await givenPlanOn(a, second.id);

    await reorderMedicalNetworks([first.id, third.id, second.id]);

    const ours = (await listMedicalNetworks()).filter((n) => n.name.startsWith(PREFIX));
    expect(ours.map((n) => n.name)).toEqual([`${PREFIX} A`, `${PREFIX} C`, `${PREFIX} B`]);
    expect((await getPlan(plan.id)).medicalNetworkId).toBe(second.id);
  });

  it('renames in place, so every plan sold on it follows', async () => {
    const { a } = await givenTwoCompanies();
    const network = await createMedicalNetwork({ name: `${PREFIX} Globmed` });
    const plan = await givenPlanOn(a, network.id);

    await updateMedicalNetwork(network.id, { name: `${PREFIX} GlobeMed` });
    expect((await getPlan(plan.id)).medicalNetworkName).toBe(`${PREFIX} GlobeMed`);
  });

  it('will not quietly delete a network plans are sold on', async () => {
    const { a } = await givenTwoCompanies();
    const network = await createMedicalNetwork({ name: `${PREFIX} GlobeMed` });
    const plan = await givenPlanOn(a, network.id);

    await expect(deleteMedicalNetwork(network.id)).rejects.toMatchObject({ status: 409 });

    // Forced, the plan survives and simply stops naming a network.
    await deleteMedicalNetwork(network.id, { force: true });
    expect((await getPlan(plan.id)).medicalNetworkId).toBeNull();
  });

  it('replaces the provider list whole and keeps the old file in its history', async () => {
    const network = await createMedicalNetwork({ name: `${PREFIX} GlobeMed` });
    expect(await resolveProviderList(network.id).catch((error) => error)).toMatchObject({
      status: 404,
    });

    const may = await givenUploadedFile('may');
    const withFile = await setProviderList(network.id, may);
    expect(withFile.providerListFileName).toBe('GlobeMed Network.xlsx');
    expect(withFile.providerListUpdatedAt).not.toBeNull();

    const september = await givenUploadedFile('september');
    await setProviderList(network.id, september);

    // The stable address now hands out the new file, under the insurer's name.
    const current = await resolveProviderList(network.id);
    expect(basename(current.path)).toBe(basename(september.storedUrl));
    expect(current.fileName).toBe('GlobeMed Network.xlsx');
    expect(await readFile(current.path, 'utf8')).toBe('september');

    // The old one is NOT gone: it is the second entry in the history, still
    // on disk and still downloadable by its own address.
    const history = (await listMedicalNetworks()).find(
      (n) => n.id === network.id,
    )!.providerListHistory!;
    expect(history.map((v) => v.isCurrent)).toEqual([true, false]);
    expect(history[1]!.fileName).toBe('GlobeMed Network.xlsx');
    const past = await resolveProviderListVersion(network.id, history[1]!.id);
    expect(await readFile(past.path, 'utf8')).toBe('may');
    expect(await exists(join(env.uploadDir, basename(may.storedUrl)))).toBe(true);

    // Taking the list off the network keeps the history, and only the
    // stable address stops answering.
    await clearProviderList(network.id);
    expect(await exists(current.path)).toBe(true);
    expect(await resolveProviderList(network.id).catch((error) => error)).toMatchObject({
      status: 404,
    });
    expect((await resolveProviderListVersion(network.id, history[0]!.id)).fileName).toBe(
      'GlobeMed Network.xlsx',
    );

    // Deleting the network takes every file with it.
    await deleteMedicalNetwork(network.id, { force: true });
    expect(await exists(current.path)).toBe(false);
    expect(await exists(past.path)).toBe(false);
  });

  it('keeps only the newest few issues, and drops the files of the rest', async () => {
    const network = await createMedicalNetwork({ name: `${PREFIX} GlobeMed` });
    const issues = ['jan', 'feb', 'mar', 'apr'];
    const files = [];
    for (const issue of issues) {
      const file = await givenUploadedFile(issue);
      files.push(file);
      await setProviderList(network.id, file);
    }

    const history = (await getMedicalNetwork(network.id)).providerListHistory!;
    expect(history).toHaveLength(3);
    expect(history[0]!.isCurrent).toBe(true);
    expect(history[0]!.sizeBytes).toBe(3);
    // January is gone, from the history and from disk.
    expect(await exists(join(env.uploadDir, basename(files[0]!.storedUrl)))).toBe(false);
    expect(await exists(join(env.uploadDir, basename(files[1]!.storedUrl)))).toBe(true);

    // A past issue can be dropped; the current one cannot.
    await deleteProviderListVersion(network.id, history[2]!.id);
    expect((await getMedicalNetwork(network.id)).providerListHistory).toHaveLength(2);
    await expect(deleteProviderListVersion(network.id, history[0]!.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('never resolves a stored path outside the upload directory', async () => {
    const network = await createMedicalNetwork({ name: `${PREFIX} GlobeMed` });
    await db().medicalNetwork.update({
      where: { id: network.id },
      data: { providerListUrl: '/uploads/../../.env', providerListFileName: 'x' },
    });
    const resolved = await resolveProviderList(network.id);
    expect(resolved.path).toBe(join(env.uploadDir, '.env'));
  });

  it('keeps the stable address answering for a retired network', async () => {
    // A customer holding an older PDF still deserves the list it promised.
    const network = await createMedicalNetwork({ name: `${PREFIX} GlobeMed` });
    await setProviderList(network.id, await givenUploadedFile('list'));
    await updateMedicalNetwork(network.id, { isActive: false });

    expect((await listMedicalNetworks()).some((n) => n.id === network.id)).toBe(false);
    expect(
      (await listMedicalNetworks({ includeInactive: true })).some((n) => n.id === network.id),
    ).toBe(true);
    expect((await resolveProviderList(network.id)).fileName).toBe('GlobeMed Network.xlsx');
  });
});
