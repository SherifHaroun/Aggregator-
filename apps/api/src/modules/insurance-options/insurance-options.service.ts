import {
  BENEFIT_VALUE_FIELD,
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

// ---------------------------------------------------------------------------
// Options (the benefit catalogue)
// ---------------------------------------------------------------------------

/** The whole catalogue. It is global, so there is nothing to scope it by. */
export async function listInsuranceOptions(
  query: ListQuery,
): Promise<Paginated<InsuranceOptionDto>> {
  const prisma = getPrisma();
  const where = {
    ...activeFilter(query.isActive),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.insuranceOption.findMany({
      where,
      include: fieldsInclude,
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
    include: fieldsInclude,
  });
  if (!option) throw notFound('Insurance option');
  return toInsuranceOptionDto(option);
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

  const sortOrder = nextSortOrder(
    await prisma.insuranceOption.aggregate({ _max: { sortOrder: true } }),
  );

  const option = await prisma.insuranceOption.create({
    data: {
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      sortOrder,
      fields: {
        create: buildFieldCreateData(
          input.fields?.length ? input.fields : [{ ...BENEFIT_VALUE_FIELD }],
          new Set<string>(),
          0,
        ),
      },
    },
    include: fieldsInclude,
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
    include: fieldsInclude,
  });
  return toInsuranceOptionDto(option);
}

/** Permanent delete, allowed only while no plan uses the option. */
export async function deleteInsuranceOption(id: string): Promise<void> {
  const prisma = getPrisma();
  const usage = await prisma.planOption.count({ where: { optionId: id } });
  if (usage > 0) throw inUse('option', `${usage} plan(s)`);
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
