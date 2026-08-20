import type { PlanOptionDto } from '@aggregator/shared';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { applyOrder, nextSortOrder } from '../../lib/ordering.js';
import { getPrisma } from '../../lib/prisma.js';
import { buildValueColumns } from './plan-option-values.js';
import { planOptionInclude, toPlanOptionDto } from './plan-options.mapper.js';
import type { AddPlanOptionInput, PlanOptionValueInputPayload } from './plan-options.schemas.js';

export async function listPlanOptions(planConfigurationId: string): Promise<PlanOptionDto[]> {
  const prisma = getPrisma();
  const configuration = await prisma.planConfiguration.findUnique({
    where: { id: planConfigurationId },
    select: { id: true },
  });
  if (!configuration) throw notFound('Plan configuration');

  const planOptions = await prisma.planOption.findMany({
    where: { planConfigurationId },
    include: planOptionInclude,
    orderBy: { sortOrder: 'asc' },
  });
  return planOptions.map(toPlanOptionDto);
}

export async function getPlanOption(planOptionId: string): Promise<PlanOptionDto> {
  const planOption = await getPrisma().planOption.findUnique({
    where: { id: planOptionId },
    include: planOptionInclude,
  });
  if (!planOption) throw notFound('Plan option');
  return toPlanOptionDto(planOption);
}

/**
 * Attach an option to ONE CONFIGURATION — the write behind dropping an option
 * onto a configuration.
 *
 * Because the row hangs off the configuration, the same option can be attached
 * to Individual+Local and to Family+Local with completely different values;
 * neither can see the other's.
 *
 * The option itself is global, so any benefit can be attached to any plan of
 * any company. Attaching creates only this relationship — never a second copy
 * of the benefit.
 *
 * Integrity rules enforced here rather than in the route:
 *  - a deactivated option cannot be newly attached,
 *  - an option can appear at most once per configuration (also a DB constraint).
 */
export async function addPlanOption(
  planConfigurationId: string,
  input: AddPlanOptionInput,
): Promise<PlanOptionDto> {
  const prisma = getPrisma();

  const [configuration, option] = await Promise.all([
    prisma.planConfiguration.findUnique({
      where: { id: planConfigurationId },
      select: { id: true },
    }),
    prisma.insuranceOption.findUnique({
      where: { id: input.optionId },
      select: { id: true, isActive: true },
    }),
  ]);

  if (!configuration) throw notFound('Plan configuration');
  if (!option) throw notFound('Insurance option');
  if (!option.isActive) {
    throw conflict('This option is deactivated and cannot be added to a configuration.');
  }

  const sortOrder = nextSortOrder(
    await prisma.planOption.aggregate({
      where: { planConfigurationId },
      _max: { sortOrder: true },
    }),
  );

  const created = await prisma.planOption.create({
    data: { planConfigurationId, optionId: input.optionId, sortOrder },
    select: { id: true },
  });

  if (input.values?.length) {
    await writeValues(created.id, input.optionId, input.values);
  }
  return getPlanOption(created.id);
}

/** Detach an option from a configuration. Its values cascade away with it. */
export async function removePlanOption(planOptionId: string): Promise<void> {
  await getPrisma().planOption.delete({ where: { id: planOptionId } });
}

/** Reorder the options inside one configuration (drag-and-drop). */
export async function reorderPlanOptions(
  planConfigurationId: string,
  orderedIds: string[],
): Promise<void> {
  const prisma = getPrisma();

  const owned = await prisma.planOption.count({
    where: { planConfigurationId, id: { in: orderedIds } },
  });
  if (owned !== orderedIds.length) {
    throw badRequest('The list contains options that do not belong to this configuration.');
  }

  await prisma.$transaction(async (tx) => {
    await applyOrder(tx.planOption, orderedIds);
  });
}

/**
 * Replace the values of one plan option.
 *
 * Fields not present in the payload are cleared, so the request describes the
 * complete configuration of that option within that plan configuration.
 */
export async function setPlanOptionValues(
  planOptionId: string,
  values: PlanOptionValueInputPayload[],
): Promise<PlanOptionDto> {
  const planOption = await getPrisma().planOption.findUnique({
    where: { id: planOptionId },
    select: { id: true, optionId: true },
  });
  if (!planOption) throw notFound('Plan option');

  await writeValues(planOptionId, planOption.optionId, values, { replace: true });
  return getPlanOption(planOptionId);
}

/**
 * Validate every value against its field definition, then persist.
 *
 * Each field is looked up on the option that this plan option points at, so a
 * value can never be written against a field belonging to a different option.
 * Values are keyed by `planOptionId`, which belongs to exactly one
 * configuration — that is what keeps configurations isolated from each other.
 */
async function writeValues(
  planOptionId: string,
  optionId: string,
  values: PlanOptionValueInputPayload[],
  { replace = false }: { replace?: boolean } = {},
): Promise<void> {
  const prisma = getPrisma();

  const fields = await prisma.optionField.findMany({ where: { optionId } });
  const fieldsById = new Map(fields.map((field) => [field.id, field]));

  const rows = values.map((entry) => {
    const field = fieldsById.get(entry.optionFieldId);
    if (!field) {
      throw badRequest(`Field ${entry.optionFieldId} does not belong to this option.`);
    }
    return { optionFieldId: field.id, columns: buildValueColumns(field, entry.value) };
  });

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.optionFieldId)) {
      throw badRequest('The same field was supplied more than once.');
    }
    seen.add(row.optionFieldId);
  }

  await prisma.$transaction(async (tx) => {
    if (replace) {
      // An empty payload clears every value for this option.
      await tx.planOptionValue.deleteMany({
        where:
          rows.length === 0
            ? { planOptionId }
            : { planOptionId, optionFieldId: { notIn: rows.map((row) => row.optionFieldId) } },
      });
    }
    for (const row of rows) {
      await tx.planOptionValue.upsert({
        where: { planOptionId_optionFieldId: { planOptionId, optionFieldId: row.optionFieldId } },
        create: { planOptionId, optionFieldId: row.optionFieldId, ...row.columns },
        update: row.columns,
      });
    }
  });
}
