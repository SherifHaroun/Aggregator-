/**
 * Renaming and deleting benefits in the catalogue, against a real PostgreSQL
 * database.
 *
 * OPT-IN, like the other database suite: it runs only when `TEST_DATABASE_URL`
 * is set, and `tests/load-env.ts` points `DATABASE_URL` at the same value, so
 * the service under test can never reach real insurance data.
 *
 * These exercise the SERVICE rather than Prisma, because the rule being pinned
 * down is a business one: what may be destroyed, and what must be asked for
 * explicitly first. Every record is namespaced and removed afterwards — test
 * fixtures, not seed data.
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createInsuranceOption,
  deleteInsuranceOption,
  updateInsuranceOption,
} from '../src/modules/insurance-options/insurance-options.service.js';
import {
  addPlanOption,
  removePlanOption,
  setPlanOptionValues,
} from '../src/modules/plan-options/plan-options.service.js';

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

const PREFIX = `test_catalogue_${Date.now()}`;
const db = () => {
  if (!prisma) throw new Error('TEST_DATABASE_URL is not set.');
  return prisma;
};

/** A plan configuration to attach benefits to. Rebuilt for every test. */
async function givenConfiguration(): Promise<string> {
  const company = await db().company.create({ data: { name: `${PREFIX}_company` } });
  const insuranceType = await db().insuranceType.create({
    data: { name: `${PREFIX}_type`, code: `${PREFIX}_type` },
  });
  const plan = await db().plan.create({
    data: {
      companyId: company.id,
      insuranceTypeId: insuranceType.id,
      name: `${PREFIX}_plan`,
      code: `${PREFIX}_plan`,
    },
  });
  const configuration = await db().planConfiguration.create({
    data: {
      planId: plan.id,
      customerType: 'INDIVIDUAL',
      geographicalCoverage: 'LOCAL',
      ageFrom: 18,
      ageTo: 60,
    },
  });
  return configuration.id;
}

/**
 * Order matters: attachments hold benefits (RESTRICT) and sub-benefits hold
 * their group, so plans go first — taking configurations and attachments with
 * them — then sub-benefits, then everything else.
 */
async function cleanup(): Promise<void> {
  if (!prisma) return;
  await prisma.plan.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.insuranceOption.deleteMany({
    where: { name: { startsWith: PREFIX }, parentId: { not: null } },
  });
  await prisma.insuranceOption.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.insuranceType.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.company.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

describe.skipIf(!url)('managing the benefit catalogue', () => {
  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma?.$disconnect();
  });

  it('deletes a benefit nothing depends on, with its field definition', async () => {
    const benefit = await createInsuranceOption({ name: `${PREFIX}_lonely`, valueKind: 'LIMIT' });

    await deleteInsuranceOption(benefit.id);

    expect(await db().insuranceOption.count({ where: { id: benefit.id } })).toBe(0);
    // The field it carried is owned by it and goes with it.
    expect(await db().optionField.count({ where: { optionId: benefit.id } })).toBe(0);
  });

  it('refuses to delete a benefit a configuration carries, and says how many', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_in_use` });
    await addPlanOption(configurationId, { optionId: benefit.id });

    await expect(deleteInsuranceOption(benefit.id)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('1 plan configuration'),
    });
    expect(await db().insuranceOption.count({ where: { id: benefit.id } })).toBe(1);
  });

  it('deletes it everywhere when that is asked for explicitly', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_forced` });
    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });
    await db().planOptionValue.create({
      data: {
        planOptionId: attached!.id,
        optionFieldId: attached!.values[0]!.optionFieldId,
        numberValue: 80,
      },
    });

    await deleteInsuranceOption(benefit.id, { force: true });

    expect(await db().insuranceOption.count({ where: { id: benefit.id } })).toBe(0);
    // The attachment and the value recorded against it go with it.
    expect(await db().planOption.count({ where: { optionId: benefit.id } })).toBe(0);
    expect(await db().planOptionValue.count({ where: { planOptionId: attached!.id } })).toBe(0);
    // The configuration itself is untouched — only its coverage changed.
    expect(await db().planConfiguration.count({ where: { id: configurationId } })).toBe(1);
  });

  it('refuses to delete a group that still holds sub-benefits', async () => {
    const group = await createInsuranceOption({ name: `${PREFIX}_group`, isUmbrella: true });
    await createInsuranceOption({ name: `${PREFIX}_part`, parentId: group.id });

    await expect(deleteInsuranceOption(group.id)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('sub-benefit'),
    });
  });

  it('takes the sub-benefits with the group when forced', async () => {
    const configurationId = await givenConfiguration();
    const group = await createInsuranceOption({ name: `${PREFIX}_group2`, isUmbrella: true });
    const part = await createInsuranceOption({ name: `${PREFIX}_part2`, parentId: group.id });
    // Attaching the group brings the part, so both are in use.
    await addPlanOption(configurationId, { optionId: group.id });

    await deleteInsuranceOption(group.id, { force: true });

    expect(await db().insuranceOption.count({ where: { id: { in: [group.id, part.id] } } })).toBe(
      0,
    );
    expect(await db().planOption.count({ where: { optionId: { in: [group.id, part.id] } } })).toBe(
      0,
    );
  });

  it('renames a benefit everywhere at once, because there is only one of it', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_before` });
    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });

    const renamed = await updateInsuranceOption(benefit.id, { name: `${PREFIX}_after` });

    expect(renamed.name).toBe(`${PREFIX}_after`);
    // The attachment points at the record, so it needed no update of its own.
    const row = await db().planOption.findUniqueOrThrow({
      where: { id: attached!.id },
      include: { option: true },
    });
    expect(row.option.name).toBe(`${PREFIX}_after`);
  });

  it('refuses a rename onto a name another benefit already has, whatever the case', async () => {
    await createInsuranceOption({ name: `${PREFIX}_taken` });
    const other = await createInsuranceOption({ name: `${PREFIX}_free` });

    await expect(
      updateInsuranceOption(other.id, { name: `${PREFIX}_TAKEN`.toUpperCase() }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('renames a sub-benefit without disturbing its group', async () => {
    const group = await createInsuranceOption({ name: `${PREFIX}_group4`, isUmbrella: true });
    const part = await createInsuranceOption({ name: `${PREFIX}_part4`, parentId: group.id });

    const renamed = await updateInsuranceOption(part.id, { name: `${PREFIX}_part4_renamed` });

    expect(renamed.name).toBe(`${PREFIX}_part4_renamed`);
    expect(renamed.parentId).toBe(group.id);
    expect(await db().insuranceOption.count({ where: { parentId: group.id } })).toBe(1);
  });

  it('switches a percentage to a limit and keeps every figure', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_kind1` });
    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });
    await setPlanOptionValues(attached!.id, [
      { optionFieldId: attached!.values[0]!.optionFieldId, value: 80 },
    ]);

    const changed = await updateInsuranceOption(benefit.id, { valueKind: 'LIMIT' });

    expect(changed.fields?.[0]?.dataType).toBe('CURRENCY');
    // Both kinds live in the number column, so nothing had to move.
    const [value] = await db().planOptionValue.findMany({ where: { planOptionId: attached!.id } });
    expect(Number(value!.numberValue)).toBe(80);
  });

  it('clears a figure the new kind cannot hold, and keeps the ones it can', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_kind2`, valueKind: 'LIMIT' });
    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });
    await setPlanOptionValues(attached!.id, [
      { optionFieldId: attached!.values[0]!.optionFieldId, value: 5000 },
    ]);

    await updateInsuranceOption(benefit.id, { valueKind: 'PERCENTAGE' });

    // 5,000 is a limit, never a percentage: cleared rather than left invalid.
    const [value] = await db().planOptionValue.findMany({ where: { planOptionId: attached!.id } });
    expect(value!.numberValue).toBeNull();
  });

  it('writes figures out as text, and reads them back as numbers', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_kind3`, valueKind: 'LIMIT' });
    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });
    const fieldId = attached!.values[0]!.optionFieldId;
    await setPlanOptionValues(attached!.id, [{ optionFieldId: fieldId, value: 100000 }]);

    await updateInsuranceOption(benefit.id, { valueKind: 'TEXT' });
    const asText = await db().planOptionValue.findFirstOrThrow({
      where: { planOptionId: attached!.id },
    });
    expect(asText.textValue).toBe('100,000');
    expect(asText.numberValue).toBeNull();

    // ...and back again: the separators do not stop it becoming a figure.
    await updateInsuranceOption(benefit.id, { valueKind: 'LIMIT' });
    const asNumber = await db().planOptionValue.findFirstOrThrow({
      where: { planOptionId: attached!.id },
    });
    expect(Number(asNumber.numberValue)).toBe(100000);
  });

  it('clears wording that cannot become a figure', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_kind4`, valueKind: 'TEXT' });
    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });
    await setPlanOptionValues(attached!.id, [
      { optionFieldId: attached!.values[0]!.optionFieldId, value: 'Golden Care Network' },
    ]);

    await updateInsuranceOption(benefit.id, { valueKind: 'PERCENTAGE' });

    const [value] = await db().planOptionValue.findMany({ where: { planOptionId: attached!.id } });
    expect(value!.numberValue).toBeNull();
    expect(value!.textValue).toBeNull();
  });

  it('refuses to change what a group carries, because it carries nothing', async () => {
    const group = await createInsuranceOption({ name: `${PREFIX}_kind5`, isUmbrella: true });

    await expect(updateInsuranceOption(group.id, { valueKind: 'LIMIT' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('removes one attachment at a time, leaving the rest of the group in place', async () => {
    const configurationId = await givenConfiguration();
    const group = await createInsuranceOption({ name: `${PREFIX}_group5`, isUmbrella: true });
    const part = await createInsuranceOption({ name: `${PREFIX}_part5`, parentId: group.id });
    const rows = await addPlanOption(configurationId, { optionId: group.id });
    const heading = rows.find((row) => row.optionId === group.id)!;

    await removePlanOption(heading.id);

    // The sub-benefit stays on the configuration with its value intact.
    expect(await db().planOption.count({ where: { planConfigurationId: configurationId } })).toBe(
      1,
    );
    expect(await db().planOption.count({ where: { optionId: part.id } })).toBe(1);
  });

  it('leaves the group standing when only one sub-benefit is deleted', async () => {
    const group = await createInsuranceOption({ name: `${PREFIX}_group3`, isUmbrella: true });
    const part = await createInsuranceOption({ name: `${PREFIX}_part3`, parentId: group.id });

    await deleteInsuranceOption(part.id);

    expect(await db().insuranceOption.count({ where: { id: part.id } })).toBe(0);
    expect(await db().insuranceOption.count({ where: { id: group.id } })).toBe(1);
  });
});
