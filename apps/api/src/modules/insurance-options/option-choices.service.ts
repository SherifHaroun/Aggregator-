/**
 * The answers a benefit offers.
 *
 * On a RANK benefit the list IS the cover, and its order is what the comparison
 * judges by. On a TEXT benefit the same list is offered as suggestions so one
 * answer stays one answer instead of becoming thirty spellings.
 *
 * The list belongs to the BENEFIT, not to a plan: "Golden Care Network" is
 * defined once for "Medical Network" and every company's plan picks from it.
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

export function toOptionChoiceDto(choice: OptionChoice): OptionChoiceDto {
  return {
    id: choice.id,
    optionId: choice.optionId,
    label: choice.label,
    sortOrder: choice.sortOrder,
    isActive: choice.isActive,
    createdAt: toIso(choice.createdAt),
    updatedAt: toIso(choice.updatedAt),
  };
}

/** Read clause for a benefit's answers, in the employee's order. */
export const choicesInclude = {
  choices: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
} as const;

export async function listOptionChoices(optionId: string): Promise<OptionChoiceDto[]> {
  const option = await getPrisma().insuranceOption.findUnique({
    where: { id: optionId },
    select: { id: true },
  });
  if (!option) throw notFound('Insurance option');

  const choices = await getPrisma().optionChoice.findMany({
    where: { optionId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return choices.map(toOptionChoiceDto);
}

/**
 * Add an answer, at the END of the list.
 *
 * The end rather than the top because position means quality here: a new
 * network silently landing above the best one would rewrite the ranking of
 * every plan that quotes the others. The employee drags it where it belongs.
 */
export async function createOptionChoice(
  optionId: string,
  input: CreateOptionChoiceInput,
): Promise<OptionChoiceDto> {
  const prisma = getPrisma();

  const option = await prisma.insuranceOption.findUnique({
    where: { id: optionId },
    select: { id: true, isUmbrella: true },
  });
  if (!option) throw notFound('Insurance option');
  if (option.isUmbrella) {
    throw conflict('A group of benefits carries no value, so it offers no answers.');
  }

  const clash = await prisma.optionChoice.findFirst({
    where: { optionId, label: { equals: input.label, mode: 'insensitive' } },
    select: { label: true },
  });
  if (clash) {
    throw conflict(`This benefit already offers "${clash.label}".`, {
      label: ['This answer already exists.'],
    });
  }

  const total = await prisma.optionChoice.count({ where: { optionId, isActive: true } });
  if (total >= BENEFIT_CHOICE_MAX) {
    throw conflict(`A benefit may offer at most ${BENEFIT_CHOICE_MAX} answers.`);
  }

  const choice = await prisma.optionChoice.create({
    data: {
      optionId,
      label: input.label,
      sortOrder:
        input.sortOrder ??
        nextSortOrder(await prisma.optionChoice.aggregate({ where: { optionId }, _max: { sortOrder: true } })),
    },
  });
  return toOptionChoiceDto(choice);
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
        optionId: existing.optionId,
        id: { not: choiceId },
        label: { equals: input.label, mode: 'insensitive' },
      },
      select: { label: true },
    });
    if (clash) {
      throw conflict(`This benefit already offers "${clash.label}".`, {
        label: ['This answer already exists.'],
      });
    }
  }

  /**
   * Renaming is safe at any time: plans store this row's ID, never its
   * wording, so correcting a spelling reaches every plan at once and breaks
   * nothing.
   */
  const choice = await prisma.optionChoice.update({ where: { id: choiceId }, data: input });
  return toOptionChoiceDto(choice);
}

/**
 * Put the answers in order. THIS is the ranking.
 *
 * Reordering deliberately does not touch a single plan value — plans hold the
 * chosen row's id — so moving a network up changes how good every plan that
 * quotes it is judged to be, and changes nothing about what those plans say.
 */
export async function reorderOptionChoices(optionId: string, orderedIds: string[]): Promise<void> {
  const prisma = getPrisma();

  const owned = await prisma.optionChoice.count({
    where: { optionId, id: { in: orderedIds } },
  });
  if (owned !== orderedIds.length) {
    throw badRequest('The list contains answers that do not belong to this benefit.');
  }

  await prisma.$transaction(async (tx) => {
    await applyOrder(tx.optionChoice, orderedIds);
  });
}

/**
 * Remove an answer.
 *
 * Refused while a plan still gives it. Deleting it would leave those plans
 * pointing at nothing — the comparison would read them as unrankable, and the
 * screen would show a blank where a network used to be. Rename it, or change
 * those plans first.
 */
export async function deleteOptionChoice(choiceId: string): Promise<void> {
  const prisma = getPrisma();

  const choice = await prisma.optionChoice.findUnique({ where: { id: choiceId } });
  if (!choice) throw notFound('Answer');

  const usage = await prisma.planOptionValue.count({ where: { textValue: choiceId } });
  if (usage > 0) {
    throw conflict(
      `"${choice.label}" is given by ${usage} plan ${usage === 1 ? 'configuration' : 'configurations'} and cannot be deleted. Change those plans first, or rename this answer.`,
    );
  }

  await prisma.optionChoice.delete({ where: { id: choiceId } });
}
