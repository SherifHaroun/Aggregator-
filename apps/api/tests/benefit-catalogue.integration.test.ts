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

import { ALTERNATIVE_VALUE_KEY } from '@aggregator/shared';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createInsuranceOption,
  createOptionField,
  deleteInsuranceOption,
  updateInsuranceOption,
  updateOptionField,
} from '../src/modules/insurance-options/insurance-options.service.js';
import { duplicatePlan } from '../src/modules/plans/plans.service.js';
import {
  addPlanOption,
  removePlanOption,
  setPlanOptionNote,
  setPlanOptionValue,
  setPlanOptionValues,
} from '../src/modules/plan-options/plan-options.service.js';

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

const PREFIX = `test_catalogue_${Date.now()}`;
const db = () => {
  if (!prisma) throw new Error('TEST_DATABASE_URL is not set.');
  return prisma;
};

/** The plan behind `givenConfiguration`, for the tests that need its id. */
let planId = '';

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
      currency: 'EGP',
      annualPrice: 7287,
    },
  });
  planId = plan.id;
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

  it('carries two figures at once, each written without disturbing the other', async () => {
    const configurationId = await givenConfiguration();
    // "800 EGP, or 80% for basic procedures" — both, not one or the other.
    const benefit = await createInsuranceOption({
      name: `${PREFIX}_two_ways`,
      valueKind: 'LIMIT',
      alternativeKind: 'PERCENTAGE',
    });
    expect(benefit.fields?.map((field) => field.dataType)).toEqual(['CURRENCY', 'PERCENTAGE']);

    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });
    const main = attached!.values.find((value) => value.fieldKey !== ALTERNATIVE_VALUE_KEY)!;
    const alternative = attached!.values.find((value) => value.fieldKey === ALTERNATIVE_VALUE_KEY)!;

    await setPlanOptionValue(attached!.id, main.optionFieldId, 800);
    const after = await setPlanOptionValue(attached!.id, alternative.optionFieldId, 80);

    // Writing the second figure must not clear the first.
    const values = Object.fromEntries(after.values.map((value) => [value.fieldKey, value.value]));
    expect(values['limit']).toBe(800);
    expect(values[ALTERNATIVE_VALUE_KEY]).toBe(80);
  });

  it('adds an alternative to a benefit that had none, and removes it again', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_late_alt`, valueKind: 'LIMIT' });
    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });
    await setPlanOptionValue(attached!.id, attached!.values[0]!.optionFieldId, 350);

    const withAlternative = await updateInsuranceOption(benefit.id, {
      alternativeKind: 'PERCENTAGE',
    });
    expect(withAlternative.fields).toHaveLength(2);

    const alternativeField = withAlternative.fields!.find(
      (field) => field.key === ALTERNATIVE_VALUE_KEY,
    )!;
    await setPlanOptionValue(attached!.id, alternativeField.id, 80);

    // Dropping it takes its figures, and leaves the main value untouched.
    const without = await updateInsuranceOption(benefit.id, { alternativeKind: null });
    expect(without.fields).toHaveLength(1);
    expect(
      await db().planOptionValue.count({ where: { optionFieldId: alternativeField.id } }),
    ).toBe(0);
    const remaining = await db().planOptionValue.findFirstOrThrow({
      where: { planOptionId: attached!.id },
    });
    expect(Number(remaining.numberValue)).toBe(350);
  });

  it('keeps a benefit note per configuration, and copies it with the age band', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_noted`, valueKind: 'LIMIT' });
    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });

    const noted = await setPlanOptionNote(attached!.id, '1 in 10 members ratio');
    expect(noted.note).toBe('1 in 10 members ratio');

    // Blank clears it rather than storing an empty remark.
    const cleared = await setPlanOptionNote(attached!.id, null);
    expect(cleared.note).toBeNull();
  });

  it('copies a plan under a new name, with the configurations chosen', async () => {
    const configurationId = await givenConfiguration();
    const benefit = await createInsuranceOption({ name: `${PREFIX}_copied_benefit` });
    const [attached] = await addPlanOption(configurationId, { optionId: benefit.id });
    await setPlanOptionValue(attached!.id, attached!.values[0]!.optionFieldId, 80);
    await setPlanOptionNote(attached!.id, 'basic procedures only');

    // A second band the copy will deliberately leave behind.
    const older = await db().planConfiguration.create({
      data: {
        planId,
        customerType: 'INDIVIDUAL',
        geographicalCoverage: 'LOCAL',
        ageFrom: 61,
        ageTo: 75,
        currency: 'EGP',
        annualPrice: 40000,
      },
    });

    const copy = await duplicatePlan(planId, {
      name: `${PREFIX}_plan_tier_two`,
      configurationIds: [configurationId],
    });

    expect(copy.id).not.toBe(planId);
    expect(copy.configurations).toHaveLength(1);
    expect(copy.configurations?.[0]?.ageFrom).toBe(18);

    // The benefit, its figure and its remark all came across.
    const copiedOption = copy.configurations?.[0]?.options?.[0];
    expect(copiedOption?.optionId).toBe(benefit.id);
    expect(copiedOption?.values[0]?.value).toBe(80);
    expect(copiedOption?.note).toBe('basic procedures only');

    // ...and the plan it came from still has both of its bands.
    expect(await db().planConfiguration.count({ where: { planId } })).toBe(2);

    await db().planConfiguration.deleteMany({ where: { id: older.id } });
  });

  it('refuses a copy that keeps the name of the plan it came from', async () => {
    await givenConfiguration();
    const source = await db().plan.findUniqueOrThrow({ where: { id: planId } });

    await expect(duplicatePlan(planId, { name: source.name })).rejects.toMatchObject({
      status: 400,
    });
    // Case is not a difference: "TIER ONE" is the same name as "tier one".
    await expect(duplicatePlan(planId, { name: source.name.toUpperCase() })).rejects.toMatchObject({
      status: 400,
    });

    expect(await db().plan.count({ where: { name: { startsWith: PREFIX } } })).toBe(1);
  });

  it('leaves the group standing when only one sub-benefit is deleted', async () => {
    const group = await createInsuranceOption({ name: `${PREFIX}_group3`, isUmbrella: true });
    const part = await createInsuranceOption({ name: `${PREFIX}_part3`, parentId: group.id });

    await deleteInsuranceOption(part.id);

    expect(await db().insuranceOption.count({ where: { id: part.id } })).toBe(0);
    expect(await db().insuranceOption.count({ where: { id: group.id } })).toBe(1);
  });
});

/**
 * A key is a field's stable machine name. Correcting one moves no data — plan
 * values reference the field by id — but it changes how every screen reads the
 * field, which is the whole point when a field's meaning has changed.
 */
describe.skipIf(!url)('correcting a setting’s key', () => {
  it('keeps the values recorded against it', async () => {
    const option = await db().insuranceOption.create({
      data: { name: `${PREFIX}_keyed_benefit` },
    });
    const field = await createOptionField(option.id, {
      label: 'Or percentage',
      key: 'alternative',
      dataType: 'PERCENTAGE',
      unit: '%',
    });

    const renamed = await updateOptionField(field.id, { key: 'coverage', label: 'Coverage' });

    expect(renamed.key).toBe('coverage');
    expect(renamed.label).toBe('Coverage');
    // Same row: nothing a plan answered has moved.
    expect(renamed.id).toBe(field.id);
  });

  it('refuses a key another setting on the same benefit already uses', async () => {
    const option = await db().insuranceOption.create({
      data: { name: `${PREFIX}_clashing_benefit` },
    });
    await createOptionField(option.id, {
      label: 'Coverage',
      key: 'coverage',
      dataType: 'PERCENTAGE',
    });
    const second = await createOptionField(option.id, {
      label: 'Or percentage',
      key: 'alternative',
      dataType: 'PERCENTAGE',
    });

    await expect(updateOptionField(second.id, { key: 'coverage' })).rejects.toMatchObject({
      status: 409,
    });
  });
});
