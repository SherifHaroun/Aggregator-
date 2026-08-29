import {
  ALTERNATIVE_VALUE_KEY,
  DEFAULT_BENEFIT_VALUE_KIND,
  PERCENTAGE_MAX,
  PERCENTAGE_MIN,
  alternativeValueField,
  benefitValueField,
  formatNumberValue,
  storageForDataType,
  type BenefitValueKind,
  type InsuranceOptionDto,
  type OptionFieldDto,
  type Paginated,
} from '@aggregator/shared';
import type { Prisma } from '@prisma/client';
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
  fields: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' as const },
    /** Each SETTING's own ranked answers — the list belongs to it, not to the
     *  benefit, because one benefit asks several questions at once. */
    include: {
      choices: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
    },
  },
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
  /**
   * How many configurations carry the benefit, so a client can tell an employee
   * what deleting it would take with it rather than finding out from a 409.
   */
  _count: { select: { planOptions: true } },
  children: {
    where: { isActive: true },
    include: { ...fieldsInclude, _count: { select: { planOptions: true } } },
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
      : [
          { ...benefitValueField(input.valueKind ?? DEFAULT_BENEFIT_VALUE_KIND) },
          // The alternative, when the benefit is quoted two ways at once.
          ...(input.alternativeKind ? [{ ...alternativeValueField(input.alternativeKind) }] : []),
        ];

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

/**
 * Change what a benefit carries — percentage, limit or text — and bring the
 * values already recorded against it across.
 *
 * The benefit's single field is rewritten in place rather than replaced, so
 * every plan keeps pointing at the same field and nothing has to be re-entered.
 * What happens to the values depends on where they are stored:
 *
 *  - **percentage <-> limit** — both live in the number column, so every value
 *    survives untouched. The one exception is a percentage a limit could hold
 *    but a percentage could not (over 100): it is cleared rather than left as
 *    an invalid percentage.
 *  - **number -> text** — each figure is written out as text, grouped as it
 *    read on screen, so nothing is lost.
 *  - **text -> number** — text that reads as a number is converted; text that
 *    does not ("Golden Care Network") cannot become one and is cleared. The
 *    client warns before this is asked for.
 *
 * Values are moved between the typed columns explicitly because the column a
 * value lives in is chosen by the data type — leaving them where they were
 * would make them invisible rather than wrong.
 */
/** The typed columns a converted value ends up in. */
interface ConvertedValue {
  numberValue: number | null;
  textValue: string | null;
}

async function changeValueKind(
  tx: Prisma.TransactionClient,
  optionId: string,
  kind: BenefitValueKind,
  { alternative = false }: { alternative?: boolean } = {},
): Promise<void> {
  const fields = await tx.optionField.findMany({ where: { optionId } });

  if (fields.length === 0) {
    throw conflict(
      'A group of benefits carries no value of its own, so there is nothing to change.',
    );
  }

  /**
   * The main value and the alternative are changed independently — they are
   * two fields of the same benefit, told apart by the alternative's stable key
   * rather than by their position.
   */
  const field = alternative
    ? fields.find((item) => item.key === ALTERNATIVE_VALUE_KEY)
    : fields.find((item) => item.key !== ALTERNATIVE_VALUE_KEY);

  if (!field) {
    throw conflict(
      'This benefit was defined with values the product does not manage, so what it carries cannot be switched in one step.',
    );
  }

  const target = alternative ? alternativeValueField(kind) : benefitValueField(kind);
  if (field.dataType === target.dataType) return;

  const fromStorage = storageForDataType(field.dataType);
  const toStorage = storageForDataType(target.dataType);

  const values = await tx.planOptionValue.findMany({ where: { optionFieldId: field.id } });

  /**
   * A ranked value is the ID of one of this benefit's answers, so switching in
   * or out of RANK is never a matter of reformatting a figure.
   *
   * Leaving RANK, the id is replaced by the answer's WORDING — "Golden Care
   * Network", not a row id nobody can read. Arriving at RANK, nothing can be
   * kept: no figure and no free text is an id, and inventing an answer to
   * match would be putting words in the plan's mouth.
   */
  const wasRanked = field.dataType === 'RANK';
  const nowRanked = target.dataType === 'RANK';
  const choiceLabels = wasRanked
    ? new Map(
        (
          await tx.optionChoice.findMany({
            // The answers belong to THIS setting, not to the benefit: a benefit
            // has several settings and each has its own list.
            where: { optionFieldId: field.id },
            select: { id: true, label: true },
          })
        )
          .map((choice) => [choice.id, choice.label] as const),
      )
    : new Map<string, string>();

  /** What each stored value becomes, or `null` where it is already correct. */
  function convert(value: (typeof values)[number]): ConvertedValue | null {
    if (wasRanked || nowRanked) {
      if (wasRanked && !nowRanked && toStorage === 'TEXT') {
        const label = value.textValue === null ? null : (choiceLabels.get(value.textValue) ?? null);
        return { numberValue: null, textValue: label };
      }
      return { numberValue: null, textValue: null };
    }

    if (fromStorage === 'NUMBER' && toStorage === 'NUMBER') {
      const current = value.numberValue === null ? null : Number(value.numberValue);
      // A limit of 5,000 is not a percentage; keep only what the new kind holds.
      const fits =
        current === null ||
        target.dataType !== 'PERCENTAGE' ||
        (current >= PERCENTAGE_MIN && current <= PERCENTAGE_MAX);
      return fits ? null : { numberValue: null, textValue: null };
    }

    if (fromStorage === 'NUMBER' && toStorage === 'TEXT') {
      return {
        numberValue: null,
        textValue: value.numberValue === null ? null : formatNumberValue(Number(value.numberValue)),
      };
    }

    if (fromStorage === 'TEXT' && toStorage === 'NUMBER') {
      // Separators are stripped so a figure entered as "100,000" survives.
      const text = value.textValue?.trim() ?? '';
      const parsed = Number(text.replace(/,/g, ''));
      const usable = text !== '' && !Number.isNaN(parsed);
      return { numberValue: usable ? parsed : null, textValue: null };
    }

    return null;
  }

  /**
   * Rows are updated in batches, one statement per distinct result.
   *
   * A benefit carried by forty configurations holds forty values, and a
   * statement each would spend longer than the transaction is allowed to live.
   * The distinct results are few — a limit is usually the same figure on every
   * configuration — so this is a couple of statements however many rows there
   * are.
   */
  const batches = new Map<string, { columns: ConvertedValue; ids: string[] }>();
  for (const value of values) {
    const columns = convert(value);
    if (!columns) continue;
    const key = JSON.stringify(columns);
    const batch = batches.get(key) ?? { columns, ids: [] };
    batch.ids.push(value.id);
    batches.set(key, batch);
  }

  for (const { columns, ids } of batches.values()) {
    await tx.planOptionValue.updateMany({
      where: { id: { in: ids } },
      data: { ...columns, booleanValue: null },
    });
  }

  await tx.optionField.update({
    where: { id: field.id },
    data: {
      label: target.label,
      key: target.key,
      dataType: target.dataType,
      unit: target.unit,
    },
  });
}

/**
 * Rename a benefit, change what it carries, or change its description or status.
 *
 * A rename is the whole point of this endpoint in the product: the benefit is
 * global, so correcting its name corrects it on every plan of every company at
 * once — the attachments point at the record, never at a copy of the name.
 *
 * The name check mirrors the one on creation, and for the same reason: the
 * case-folded unique index is the guarantee, and this is what turns a
 * constraint violation into a sentence an employee can act on.
 */
export async function updateInsuranceOption(
  id: string,
  input: UpdateInsuranceOptionInput,
): Promise<InsuranceOptionDto> {
  const prisma = getPrisma();

  if (input.name !== undefined) {
    const existing = await prisma.insuranceOption.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' }, id: { not: id } },
      select: { name: true },
    });
    if (existing) {
      throw conflict(
        `This benefit already exists — "${existing.name}" is available to every plan.`,
      );
    }
  }

  const { valueKind, alternativeKind, ...rest } = input;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(rest).length > 0) {
      await tx.insuranceOption.update({ where: { id }, data: rest });
    }
    if (valueKind !== undefined) await changeValueKind(tx, id, valueKind);

    if (alternativeKind !== undefined) {
      const existing = await tx.optionField.findFirst({
        where: { optionId: id, key: ALTERNATIVE_VALUE_KEY },
        select: { id: true },
      });

      if (alternativeKind === null) {
        // Dropping the alternative drops the figures recorded against it; the
        // client says so before asking.
        if (existing) await tx.optionField.delete({ where: { id: existing.id } });
      } else if (existing) {
        await changeValueKind(tx, id, alternativeKind, { alternative: true });
      } else {
        const definition = alternativeValueField(alternativeKind);
        const sortOrder = nextSortOrder(
          await tx.optionField.aggregate({ where: { optionId: id }, _max: { sortOrder: true } }),
        );
        await tx.optionField.create({
          data: {
            optionId: id,
            label: definition.label,
            key: definition.key,
            dataType: definition.dataType,
            unit: definition.unit,
            sortOrder,
          },
        });
      }
    }
  });

  const option = await prisma.insuranceOption.findUnique({
    where: { id },
    include: catalogueInclude,
  });
  if (!option) throw notFound('Insurance option');
  return toInsuranceOptionDto(option);
}

/**
 * Permanently delete a benefit from the catalogue.
 *
 * Two levels, because the two things an employee means are different:
 *
 *  - **Without `force`** the benefit goes only if nothing depends on it — no
 *    configuration carries it, and no sub-benefit sits under it. This is the
 *    safe default and the historical policy: a benefit in use is normally
 *    deactivated, not destroyed.
 *  - **With `force`** the deletion is carried through: the benefit is detached
 *    from every configuration that carries it and, if it is a group, its
 *    sub-benefits are deleted with it. The employee is told the count first and
 *    asks for this explicitly; nothing here decides it on their behalf.
 *
 * Either way this removes DEFINITIONS. Detaching a benefit from one
 * configuration is a different operation entirely — see `removePlanOption`.
 */
export async function deleteInsuranceOption(
  id: string,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  const prisma = getPrisma();

  const option = await prisma.insuranceOption.findUnique({
    where: { id },
    select: { id: true, isUmbrella: true, children: { select: { id: true } } },
  });
  if (!option) throw notFound('Insurance option');

  // A group is deleted as a whole: itself and everything filed under it.
  const optionIds = [option.id, ...option.children.map((child) => child.id)];
  const usage = await prisma.planOption.count({ where: { optionId: { in: optionIds } } });

  if (!force) {
    if (usage > 0) throw inUse('benefit', `${usage} plan configuration(s)`);
    if (option.children.length > 0) {
      throw conflict(
        `This group holds ${option.children.length} sub-benefit(s). Deleting it deletes them too — confirm the deletion to go ahead.`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    // Attachments first: their values cascade with them.
    await tx.planOption.deleteMany({ where: { optionId: { in: optionIds } } });
    // Then the sub-benefits, so nothing is left pointing at a deleted parent.
    await tx.insuranceOption.deleteMany({ where: { parentId: option.id } });
    // Field definitions are owned by the option and cascade with it.
    await tx.insuranceOption.delete({ where: { id: option.id } });
  });
}

/** Reorder the catalogue (drag-and-drop of the available-options list). */
export async function reorderInsuranceOptions(orderedIds: string[]): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await applyOrder(tx, 'insurance_options', orderedIds);
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
      // A condition rather than a core field, and the condition it sits inside.
      ...(field.isOptional !== undefined ? { isOptional: field.isOptional } : {}),
      ...(field.parentFieldId !== undefined ? { parentFieldId: field.parentFieldId } : {}),
      // Revealed by one answer, and scoped to the buyers it can apply to.
      ...(field.showWhenChoiceId !== undefined
        ? { showWhenChoiceId: field.showWhenChoiceId }
        : {}),
      ...(field.customerTypes !== undefined ? { customerTypes: field.customerTypes } : {}),
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
    await applyOrder(tx, 'option_fields', orderedIds);
  });
}
