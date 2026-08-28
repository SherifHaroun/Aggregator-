import type { PlanOptionDto } from '@aggregator/shared';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { applyOrder, nextSortOrder } from '../../lib/ordering.js';
import { getPrisma } from '../../lib/prisma.js';
import { resolveLimitationsForPlanOption } from '../limitations/limitations.service.js';
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
 * A GROUP TRAVELS WITH ITS PARTS. Dropping an umbrella attaches its
 * sub-benefits too, since a group on its own carries nothing and would show as
 * an empty heading; dropping a sub-benefit attaches its umbrella, so the row
 * always has the heading it belongs under. That is why this returns a list:
 * one gesture can legitimately create several rows, and the client needs all of
 * them to render what just happened.
 *
 * Integrity rules enforced here rather than in the route:
 *  - a deactivated option cannot be newly attached,
 *  - an option can appear at most once per configuration (also a DB constraint).
 */
export async function addPlanOption(
  planConfigurationId: string,
  input: AddPlanOptionInput,
): Promise<PlanOptionDto[]> {
  const prisma = getPrisma();

  const [configuration, option] = await Promise.all([
    prisma.planConfiguration.findUnique({
      where: { id: planConfigurationId },
      select: { id: true },
    }),
    prisma.insuranceOption.findUnique({
      where: { id: input.optionId },
      select: {
        id: true,
        isActive: true,
        isUmbrella: true,
        parentId: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true },
        },
      },
    }),
  ]);

  if (!configuration) throw notFound('Plan configuration');
  if (!option) throw notFound('Insurance option');
  if (!option.isActive) {
    throw conflict('This option is deactivated and cannot be added to a configuration.');
  }

  /**
   * The whole group, in the order it reads: the umbrella first, then its
   * sub-benefits. A benefit that belongs to no group is a list of one.
   */
  const optionIds = option.isUmbrella
    ? [option.id, ...option.children.map((child) => child.id)]
    : option.parentId
      ? [option.parentId, option.id]
      : [option.id];

  const existing = await prisma.planOption.findMany({
    where: { planConfigurationId, optionId: { in: optionIds } },
    select: { id: true, optionId: true },
  });
  const alreadyAttached = new Map(existing.map((row) => [row.optionId, row.id]));

  const missing = optionIds.filter((id) => !alreadyAttached.has(id));
  if (missing.length === 0 && !input.values?.length) {
    throw conflict('This benefit is already on this configuration.');
  }

  let sortOrder = nextSortOrder(
    await prisma.planOption.aggregate({
      where: { planConfigurationId },
      _max: { sortOrder: true },
    }),
  );

  for (const optionId of missing) {
    const created = await prisma.planOption.create({
      data: { planConfigurationId, optionId, sortOrder },
      select: { id: true },
    });
    alreadyAttached.set(optionId, created.id);
    sortOrder += 1;
  }

  // Values supplied with the request configure the benefit that was named,
  // never the rest of its group.
  const namedPlanOptionId = alreadyAttached.get(option.id);
  if (input.values?.length && namedPlanOptionId) {
    await writeValues(namedPlanOptionId, option.id, input.values);
  }

  const planOptions = await prisma.planOption.findMany({
    where: { id: { in: optionIds.flatMap((id) => alreadyAttached.get(id) ?? []) } },
    include: planOptionInclude,
    orderBy: { sortOrder: 'asc' },
  });
  return planOptions.map(toPlanOptionDto);
}

/**
 * Detach ONE option from a configuration. Its values cascade away with it.
 *
 * Exactly one attachment goes — never a sub-benefit alongside its group, and
 * never a group alongside a part of it. Removing a heading used to take its
 * parts with it, which meant one click silently removed six rows and their
 * recorded values; each row is now removed by the click that names it.
 *
 * A sub-benefit whose group is no longer attached still renders, at the top
 * level, so nothing disappears from view either.
 *
 * The catalogue is untouched: this deletes an attachment, never a benefit.
 */
export async function removePlanOption(planOptionId: string): Promise<void> {
  const prisma = getPrisma();

  const planOption = await prisma.planOption.findUnique({
    where: { id: planOptionId },
    select: { id: true },
  });
  if (!planOption) throw notFound('Plan option');

  await prisma.planOption.delete({ where: { id: planOptionId } });
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
 * Write the remark carried by one benefit on one configuration.
 *
 * Separate from the values because it is written separately: the note sits
 * beside the figure on the row and saves itself, and neither should overwrite
 * the other. Blank clears it.
 */
export async function setPlanOptionNote(
  planOptionId: string,
  note: string | null,
): Promise<PlanOptionDto> {
  const planOption = await getPrisma().planOption.findUnique({
    where: { id: planOptionId },
    select: { id: true },
  });
  if (!planOption) throw notFound('Plan option');

  await getPrisma().planOption.update({ where: { id: planOptionId }, data: { note } });
  return getPlanOption(planOptionId);
}

/**
 * Replace the qualifications one benefit carries on one configuration.
 *
 * Written as a complete set rather than added and removed one at a time,
 * because that is what the control does and what the record means: these are
 * the restrictions, and anything absent is not imposed. An empty list is a
 * legitimate, meaningful write — it says the cover has no conditions.
 *
 * The rows are replaced inside one transaction, so a benefit is never briefly
 * seen carrying half its restrictions by a comparison running at the same time.
 */
export async function setPlanOptionLimitations(
  planOptionId: string,
  limitationIds: string[],
): Promise<PlanOptionDto> {
  const prisma = getPrisma();

  const planOption = await prisma.planOption.findUnique({
    where: { id: planOptionId },
    select: { id: true },
  });
  if (!planOption) throw notFound('Plan option');

  const resolved = await resolveLimitationsForPlanOption(limitationIds);

  await prisma.$transaction(async (tx) => {
    await tx.planOptionLimitation.deleteMany({
      where:
        resolved.length === 0
          ? { planOptionId }
          : { planOptionId, limitationId: { notIn: resolved } },
    });
    if (resolved.length > 0) {
      await tx.planOptionLimitation.createMany({
        data: resolved.map((limitationId) => ({ planOptionId, limitationId })),
        skipDuplicates: true,
      });
    }
  });

  return getPlanOption(planOptionId);
}

/**
 * Write ONE value of a plan option, leaving its other values alone.
 *
 * A benefit may carry two figures at once — "800 EGP or 80%" — and each is
 * edited in its own box that saves itself. A replace would mean every box had
 * to know what the others hold and send them back, and the first one saved
 * would wipe the second. This writes exactly the field it names.
 */
export async function setPlanOptionValue(
  planOptionId: string,
  optionFieldId: string,
  value: PlanOptionValueInputPayload['value'],
): Promise<PlanOptionDto> {
  const planOption = await getPrisma().planOption.findUnique({
    where: { id: planOptionId },
    select: { id: true, optionId: true },
  });
  if (!planOption) throw notFound('Plan option');

  await writeValues(planOptionId, planOption.optionId, [{ optionFieldId, value }]);
  return getPlanOption(planOptionId);
}

/**
 * Replace ALL the values of one plan option.
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

  /**
   * A ranked value is the id of one of the benefit's own answers. Checked here
   * rather than in `buildValueColumns`, which sees a field but not the benefit
   * the answers belong to. Without this an id from another benefit — or a
   * deleted one — would store cleanly and then read back as blank.
   */
  const ranked = fields.some((field) => field.dataType === 'RANK');
  const choiceIds = ranked
    ? new Set(
        (
          await prisma.optionChoice.findMany({
            where: { optionId, isActive: true },
            select: { id: true },
          })
        ).map((choice) => choice.id),
      )
    : new Set<string>();

  const rows = values.map((entry) => {
    const field = fieldsById.get(entry.optionFieldId);
    if (!field) {
      throw badRequest(`Field ${entry.optionFieldId} does not belong to this option.`);
    }

    if (
      field.dataType === 'RANK' &&
      typeof entry.value === 'string' &&
      entry.value.trim() !== '' &&
      !choiceIds.has(entry.value)
    ) {
      throw badRequest(`"${field.label}" must be one of the answers this benefit offers.`, {
        [field.key]: ['Choose one of the answers listed for this benefit.'],
      });
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
