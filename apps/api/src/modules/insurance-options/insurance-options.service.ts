import {
  DEFAULT_BENEFIT_VALUE_KIND,
  benefitValueField,
  type InsuranceOptionDto,
  type OptionFieldDto,
  type Paginated,
} from '@aggregator/shared';
import { conflict, inUse, notFound } from '../../lib/errors.js';
import { applyOrder, nextSortOrder } from '../../lib/ordering.js';
import { activeFilter, paginate, toSkipTake, type ListQuery } from '../../lib/pagination.js';
import { getPrisma } from '../../lib/prisma.js';
import { toRecordKey, uniqueRecordKey } from '../../lib/record-key.js';
import { toInsuranceOptionDto, toOptionFieldDto } from './insurance-options.mapper.js';
import type {
  CreateInsuranceOptionInput,
  OptionFieldInput,
  UpdateInsuranceOptionInput,
  UpdateOptionFieldInput,
} from './insurance-options.schemas.js';

const fieldsInclude = {
  fields: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
};

/**
 * A benefit with its fields and, when it is an umbrella, the sub-benefits
 * underneath it.
 *
 * One level deep, which is the whole hierarchy: a sub-benefit cannot itself be
 * an umbrella, so this include always returns the complete tree.
 */
const catalogueInclude = {
  ...fieldsInclude,
  children: {
    where: { isActive: true },
    include: fieldsInclude,
    orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
  },
};

// ---------------------------------------------------------------------------
// Options (the benefit catalogue)
// ---------------------------------------------------------------------------

/**
 * The whole catalogue. It is global, so there is nothing to scope it by.
 *
 * Sub-benefits are returned INSIDE their umbrella rather than beside it, so a
 * client renders the catalogue as the business describes it — "Life & Accident
 * Coverage" with its parts under it — from a single response. A search still
 * looks at every benefit, and an umbrella whose sub-benefit matches comes back
 * with it.
 */
export async function listInsuranceOptions(
  query: ListQuery,
): Promise<Paginated<InsuranceOptionDto>> {
  const prisma = getPrisma();
  const search = query.search
    ? { contains: query.search, mode: 'insensitive' as const }
    : undefined;

  const where = {
    ...activeFilter(query.isActive),
    // Top level only: the sub-benefits ride along inside their umbrella.
    parentId: null,
    ...(search ? { OR: [{ name: search }, { children: { some: { name: search } } }] } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.insuranceOption.findMany({
      where,
      include: catalogueInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      ...toSkipTake(query),
    }),
    prisma.insuranceOption.count({ where }),
  ]);

  return paginate(items.map(toInsuranceOptionDto), total, query);
}

export async function getInsuranceOption(id: string): Promise<InsuranceOptionDto> {
  const option = await getPrisma().insuranceOption.findUnique({
    where: { id },
    include: catalogueInclude,
  });
  if (!option) throw notFound('Insurance option');
  return toInsuranceOptionDto(option);
}

/**
 * Check where a new benefit is being placed, and refuse a placement that would
 * not make sense.
 *
 * Two rules, both here rather than spread across the routes: only an umbrella
 * may hold sub-benefits, and a sub-benefit may not itself be one. Together they
 * bound the tree at `MAX_BENEFIT_DEPTH`, which is what lets every screen render
 * the whole catalogue without recursing.
 */
async function checkParent(parentId: string, isUmbrella: boolean): Promise<void> {
  if (isUmbrella) {
    throw conflict(
      'A group of benefits cannot sit inside another group. Create it at the top level instead.',
    );
  }

  const parent = await getPrisma().insuranceOption.findUnique({
    where: { id: parentId },
    select: { id: true, name: true, isUmbrella: true },
  });
  if (!parent) throw notFound('Parent benefit');
  if (!parent.isUmbrella) {
    throw conflict(
      `"${parent.name}" carries its own value, so it cannot hold sub-benefits. Only a group of benefits can.`,
    );
  }
}

/**
 * Create a benefit, once, for the whole application.
 *
 * This is the operation that makes the system data-driven: an employee can
 * define a benefit that has never existed before and no code or schema changes.
 *
 * The benefit is GLOBAL — it belongs to no company and no insurance type, so
 * every plan can use it the moment it exists. Only the values it takes differ
 * per plan configuration.
 *
 * A caller that supplies no `fields` gets the standard benefit shape — a single
 * percentage value — so creating a benefit needs nothing but a name. The
 * general form is still accepted, which is what keeps the model open to
 * benefits that one day need something else.
 */
export async function createInsuranceOption(
  input: CreateInsuranceOptionInput,
): Promise<InsuranceOptionDto> {
  const prisma = getPrisma();

  /**
   * Checked case-insensitively so "dental" cannot be added beside "Dental".
   * The unique index on `name` is still the guarantee; this is what turns a
   * constraint violation into a sentence an employee can act on.
   */
  const existing = await prisma.insuranceOption.findFirst({
    where: { name: { equals: input.name, mode: 'insensitive' } },
    select: { name: true },
  });
  if (existing) {
    throw conflict(`This benefit already exists — "${existing.name}" is available to every plan.`);
  }

  const isUmbrella = input.isUmbrella ?? false;
  const parentId = input.parentId ?? null;
  if (parentId) await checkParent(parentId, isUmbrella);

  /**
   * An umbrella holds no value, so it is created with no fields at all.
   * Everything else gets exactly one field, taken from the kind the employee
   * chose — which is why nobody is ever asked about data types or units.
   */
  const fields = isUmbrella
    ? []
    : input.fields?.length
      ? input.fields
      : [{ ...benefitValueField(input.valueKind ?? DEFAULT_BENEFIT_VALUE_KIND) }];

  // Sub-benefits are ordered within their umbrella, top-level ones globally.
  const sortOrder = nextSortOrder(
    await prisma.insuranceOption.aggregate({ where: { parentId }, _max: { sortOrder: true } }),
  );

  const option = await prisma.insuranceOption.create({
    data: {
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      isUmbrella,
      parentId,
      sortOrder,
      fields: { create: buildFieldCreateData(fields, new Set<string>(), 0) },
    },
    include: catalogueInclude,
  });

  return toInsuranceOptionDto(option);
}

export async function updateInsuranceOption(
  id: string,
  input: UpdateInsuranceOptionInput,
): Promise<InsuranceOptionDto> {
  const option = await getPrisma().insuranceOption.update({
    where: { id },
    data: input,
    include: catalogueInclude,
  });
  return toInsuranceOptionDto(option);
}

/**
 * Permanent delete, allowed only while no plan uses the option and — for an
 * umbrella — while nothing still sits under it. Deleting a group otherwise
 * would either orphan its sub-benefits or take their plan values with them, so
 * the employee empties it first.
 */
export async function deleteInsuranceOption(id: string): Promise<void> {
  const prisma = getPrisma();
  const [usage, children] = await Promise.all([
    prisma.planOption.count({ where: { optionId: id } }),
    prisma.insuranceOption.count({ where: { parentId: id } }),
  ]);
  if (usage > 0) throw inUse('option', `${usage} plan(s)`);
  if (children > 0) throw inUse('group of benefits', `${children} sub-benefit(s)`);
  // Field definitions are owned by the option and cascade with it.
  await prisma.insuranceOption.delete({ where: { id } });
}

/** Reorder the catalogue (drag-and-drop of the available-options list). */
export async function reorderInsuranceOptions(orderedIds: string[]): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await applyOrder(tx.insuranceOption, orderedIds);
  });
}

// ---------------------------------------------------------------------------
// Option fields (what information an option requires)
// ---------------------------------------------------------------------------

function buildFieldCreateData(fields: OptionFieldInput[], taken: Set<string>, offset: number) {
  return fields.map((field, index) => {
    const key = uniqueRecordKey(field.key ?? toRecordKey(field.label), taken);
    taken.add(key);
    return {
      label: field.label,
      key,
      dataType: field.dataType,
      ...(field.unit !== undefined ? { unit: field.unit } : {}),
      ...(field.helpText !== undefined ? { helpText: field.helpText } : {}),
      ...(field.isRequired !== undefined ? { isRequired: field.isRequired } : {}),
      ...(field.isActive !== undefined ? { isActive: field.isActive } : {}),
      sortOrder: offset + index,
    };
  });
}

export async function listOptionFields(optionId: string): Promise<OptionFieldDto[]> {
  const prisma = getPrisma();
  const option = await prisma.insuranceOption.findUnique({
    where: { id: optionId },
    select: { id: true },
  });
  if (!option) throw notFound('Insurance option');

  const fields = await prisma.optionField.findMany({
    where: { optionId },
    orderBy: { sortOrder: 'asc' },
  });
  return fields.map(toOptionFieldDto);
}

export async function createOptionField(
  optionId: string,
  input: OptionFieldInput,
): Promise<OptionFieldDto> {
  const prisma = getPrisma();
  const option = await prisma.insuranceOption.findUnique({
    where: { id: optionId },
    select: { id: true },
  });
  if (!option) throw notFound('Insurance option');

  const existing = await prisma.optionField.findMany({
    where: { optionId },
    select: { key: true },
  });
  const taken = new Set(existing.map((field) => field.key));
  const sortOrder = nextSortOrder(
    await prisma.optionField.aggregate({ where: { optionId }, _max: { sortOrder: true } }),
  );
  const [data] = buildFieldCreateData([input], taken, sortOrder);
  if (!data) throw conflict('Could not build the field definition.');

  const field = await prisma.optionField.create({ data: { ...data, optionId } });
  return toOptionFieldDto(field);
}

export async function updateOptionField(
  fieldId: string,
  input: UpdateOptionFieldInput,
): Promise<OptionFieldDto> {
  const prisma = getPrisma();

  /**
   * Changing the data type would leave existing plan values in the wrong typed
   * column. Retire the field and create a new one instead.
   */
  if (input.dataType !== undefined) {
    const current = await prisma.optionField.findUnique({
      where: { id: fieldId },
      select: { dataType: true, _count: { select: { values: true } } },
    });
    if (!current) throw notFound('Option field');
    if (input.dataType !== current.dataType && current._count.values > 0) {
      throw conflict(
        'The data type cannot be changed once plans have supplied values for this field. Deactivate it and add a new field instead.',
      );
    }
  }

  const field = await prisma.optionField.update({ where: { id: fieldId }, data: input });
  return toOptionFieldDto(field);
}

/**
 * Permanent delete of a field definition, allowed only while no plan has
 * supplied a value for it — deleting otherwise would destroy plan data.
 */
export async function deleteOptionField(fieldId: string): Promise<void> {
  const prisma = getPrisma();
  const valueCount = await prisma.planOptionValue.count({ where: { optionFieldId: fieldId } });
  if (valueCount > 0) throw inUse('field', `${valueCount} plan value(s)`);
  await prisma.optionField.delete({ where: { id: fieldId } });
}

export async function reorderOptionFields(orderedIds: string[]): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await applyOrder(tx.optionField, orderedIds);
  });
}
