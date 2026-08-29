import type { CustomerTypeId, PlanOptionValueDto } from '@aggregator/shared';

/**
 * Which of a benefit's settings this plan should be asked about at all.
 *
 * Some questions do not exist for some buyers. A member ratio — "one in twenty
 * members" — is a rule about a group, and an individual policy has no group, so
 * putting the box on an individual plan invites an answer that cannot be true.
 *
 * An EMPTY list means the setting applies to everyone, which is what almost
 * every setting says and what every setting said before this existed.
 */
export function appliesToCustomerType(
  value: Pick<PlanOptionValueDto, 'customerTypes'>,
  customerType: CustomerTypeId,
): boolean {
  return value.customerTypes.length === 0 || value.customerTypes.includes(customerType);
}

/**
 * The inputs a setting reveals, given the answer it currently holds.
 *
 * Two kinds live side by side under one parent:
 *
 *  - inputs with no `showWhenChoiceId` belong to the setting itself and appear
 *    whenever it does — the two boxes of "one in twenty members";
 *  - inputs WITH one belong to a single answer, and appear only when that
 *    answer is chosen. This is what makes "Other" a real answer rather than a
 *    dead end: picking it reveals the box that says what it actually was.
 *
 * Anything scoped to other customer types is dropped here too, so a revealed
 * box never smuggles in a question the buyer cannot answer.
 */
export function revealedInputs(
  parent: PlanOptionValueDto,
  customerType: CustomerTypeId,
): PlanOptionValueDto[] {
  const chosen = typeof parent.value === 'string' ? parent.value : null;

  return (parent.subValues ?? [])
    .filter((input) => appliesToCustomerType(input, customerType))
    .filter((input) =>
      input.showWhenChoiceId === null ? true : input.showWhenChoiceId === chosen,
    );
}
