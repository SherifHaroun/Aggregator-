/**
 * The answers a SETTING offers, and the order they are ranked in.
 *
 * The list belongs to the setting rather than to the benefit, because one
 * benefit asks several questions at once: inpatient cover has a coverage
 * percentage, a co-payment, network access, a room type, an ICU allowance and
 * a list of inclusions. "Private room" is an answer to exactly one of those.
 *
 * On a RANK setting the top answer is the BEST cover; on a MULTI setting of
 * restrictions the top is the MILDEST. Either way the order is the judgement,
 * and no weight is ever typed.
 */

import { BENEFIT_CHOICE_MAX, type OptionChoiceDto } from '@aggregator/shared';
import type { OptionChoice } from '@prisma/client';
import { toIso } from '../../lib/decimal.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { applyOrder, nextSortOrder } from '../../lib/ordering.js';
import { getPrisma } from '../../lib/prisma.js';
import type {
  CreateOptionChoiceInput,
  UpdateOptionChoiceInput,
} from './insurance-options.schemas.js';

/**
 * `rankCount` travels with every answer because a rank means nothing without
 * it: third of four is a strong statement, third of thirty is barely one.
 */
export function toOptionChoiceDto(choice: OptionChoice, rankCount: number): OptionChoiceDto {
  return {
    id: choice.id,
    optionFieldId: choice.optionFieldId,
    label: choice.label,
    sortOrder: choice.sortOrder,
    rankCount,
    isActive: choice.isActive,
    createdAt: toIso(choice.createdAt),
    updatedAt: toIso(choice.updatedAt),
  };
}

/** A setting's answers, with the list length already applied to each. */
export function toChoiceDtos(choices: OptionChoice[]): OptionChoiceDto[] {
  return choices.map((choice) => toOptionChoiceDto(choice, choices.length));
}

/** Read clause for a setting's answers, in rank order. */
export const choicesInclude = {
  choices: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
} as const;

export async function listOptionChoices(optionFieldId: string): Promise<OptionChoiceDto[]> {
  const field = await getPrisma().optionField.findUnique({
    where: { id: optionFieldId },
    select: { id: true },
  });
  if (!field) throw notFound('Setting');

  return toChoiceDtos(
    await getPrisma().optionChoice.findMany({
      where: { optionFieldId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  );
}

/**
 * Add an answer, at the BOTTOM of the list.
 *
 * The bottom rather than the top because position is meaning here: on a ranked
 * setting the top is "the best cover we know of", and on a list of restrictions
 * it is "the mildest". An answer nobody has ranked yet is an unknown, and
 * landing it at either extreme by default would quietly re-judge every plan
 * that already carries the others. The bottom is visible, and a drag away.
 */
export async function createOptionChoice(
  optionFieldId: string,
  input: CreateOptionChoiceInput,
): Promise<OptionChoiceDto> {
  const prisma = getPrisma();

  const field = await prisma.optionField.findUnique({
    where: { id: optionFieldId },
    select: { id: true },
  });
  if (!field) throw notFound('Setting');

  const clash = await prisma.optionChoice.findFirst({
    where: { optionFieldId, label: { equals: input.label, mode: 'insensitive' } },
    select: { label: true },
  });
  if (clash) {
    throw conflict(`This setting already offers "${clash.label}".`, {
      label: ['This answer already exists.'],
    });
  }

  const total = await prisma.optionChoice.count({ where: { optionFieldId, isActive: true } });
  if (total >= BENEFIT_CHOICE_MAX) {
    throw conflict(`A setting may offer at most ${BENEFIT_CHOICE_MAX} answers.`);
  }

  await prisma.optionChoice.create({
    data: {
      optionFieldId,
      label: input.label,
      sortOrder: nextSortOrder(
        await prisma.optionChoice.aggregate({
          where: { optionFieldId },
          _max: { sortOrder: true },
        }),
      ),
    },
  });

  // Re-read: adding an answer lengthens the list every other rank is read
  // against, so the whole set has to be reported afresh.
  const answers = await listOptionChoices(optionFieldId);
  return answers[answers.length - 1]!;
}

export async function updateOptionChoice(
  choiceId: string,
  input: UpdateOptionChoiceInput,
): Promise<OptionChoiceDto> {
  const prisma = getPrisma();

  const existing = await prisma.optionChoice.findUnique({ where: { id: choiceId } });
  if (!existing) throw notFound('Answer');

  if (input.label !== undefined && input.label.toLowerCase() !== existing.label.toLowerCase()) {
    const clash = await prisma.optionChoice.findFirst({
      where: {
        optionFieldId: existing.optionFieldId,
        id: { not: choiceId },
        label: { equals: input.label, mode: 'insensitive' },
      },
      select: { label: true },
    });
    if (clash) {
      throw conflict(`This setting already offers "${clash.label}".`, {
        label: ['This answer already exists.'],
      });
    }
  }

  /**
   * Renaming is safe at any time: plans record WHICH answer they gave, by id,
   * never its wording — so correcting a spelling reaches every plan at once and
   * breaks nothing.
   */
  const choice = await prisma.optionChoice.update({ where: { id: choiceId }, data: input });
  const total = await prisma.optionChoice.count({
    where: { optionFieldId: choice.optionFieldId, isActive: true },
  });
  return toOptionChoiceDto(choice, total);
}

/**
 * Put a setting's answers in order. THIS is the weighting.
 *
 * Not a single plan value is touched — a plan records which answer it gave, not
 * what that answer is worth — so re-ranking changes how every affected plan is
 * judged and changes nothing about what any of them says.
 */
export async function reorderOptionChoices(
  optionFieldId: string,
  orderedIds: string[],
): Promise<void> {
  const prisma = getPrisma();

  const owned = await prisma.optionChoice.count({
    where: { optionFieldId, id: { in: orderedIds } },
  });
  if (owned !== orderedIds.length) {
    throw badRequest('The list contains answers that do not belong to this setting.');
  }

  await prisma.$transaction(async (tx) => {
    await applyOrder(tx, 'option_choices', orderedIds);
  });
}

/**
 * Remove an answer.
 *
 * Refused by default while plans still record it: on a ranked setting they
 * would be left pointing at nothing, and on a list of restrictions every one of
 * them would silently start reading as UNRESTRICTED. `force` carries it through
 * once the caller has been told how many plans that is.
 */
export async function deleteOptionChoice(choiceId: string, { force = false } = {}): Promise<void> {
  const prisma = getPrisma();

  const choice = await prisma.optionChoice.findUnique({ where: { id: choiceId } });
  if (!choice) throw notFound('Answer');

  const [picked, ticked] = await Promise.all([
    prisma.planOptionValue.count({ where: { textValue: choiceId } }),
    prisma.planOptionValueChoice.count({ where: { choiceId } }),
  ]);
  const usage = picked + ticked;

  if (usage > 0 && !force) {
    throw conflict(
      `"${choice.label}" is recorded on ${usage} plan ${usage === 1 ? 'benefit' : 'benefits'}. Removing it takes it off ${usage === 1 ? 'that one' : 'those'} too. Rename it instead, or confirm to remove it everywhere.`,
      { usageCount: [String(usage)] },
    );
  }

  await prisma.$transaction(async (tx) => {
    /**
     * Ticked rows cascade with the answer. A RANK value has to be cleared by
     * hand: it stores the id in a plain column, and an id pointing at nothing
     * would render as a blank rather than as "not recorded".
     */
    await tx.planOptionValue.updateMany({
      where: { textValue: choiceId },
      data: { textValue: null },
    });
    await tx.optionChoice.delete({ where: { id: choiceId } });
  });
}

/**
 * Validate the answers ticked on ONE setting.
 *
 * Checked as a set: unknown ids, ids belonging to another setting, retired
 * answers and duplicates are all refused outright rather than silently dropped,
 * because a half-written set would misstate the cover — and misstating cover is
 * the one thing this whole feature exists to stop.
 */
export async function resolveTickedChoices(
  optionFieldId: string,
  choiceIds: string[],
): Promise<string[]> {
  const unique = [...new Set(choiceIds)];
  if (unique.length !== choiceIds.length) {
    throw badRequest('The same answer was supplied more than once.');
  }
  if (unique.length === 0) return [];

  const found = await getPrisma().optionChoice.findMany({
    where: { id: { in: unique }, optionFieldId, isActive: true },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw badRequest('One of those answers does not belong to this setting.');
  }

  return unique;
}
