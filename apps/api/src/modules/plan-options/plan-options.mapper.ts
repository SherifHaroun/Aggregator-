import { rankLabel, type PlanOptionDto, type PlanOptionValueDto } from '@aggregator/shared';
import type {
  InsuranceOption,
  OptionChoice,
  OptionField,
  PlanOption,
  PlanOptionValue,
  PlanOptionValueChoice,
} from '@prisma/client';
import { toIso } from '../../lib/decimal.js';
import { toChoiceDtos } from '../insurance-options/option-choices.service.js';
import { readValue } from './plan-option-values.js';

export type PlanOptionWithRelations = PlanOption & {
  option: InsuranceOption & { fields: (OptionField & { choices: OptionChoice[] })[] };
  values: PlanOptionValue[];
  selectedChoices: PlanOptionValueChoice[];
};

/**
 * Produce one entry per ACTIVE setting of the benefit, whether or not the plan
 * has supplied a value. The frontend can therefore render the form for any
 * benefit without knowing which settings exist, and unfilled ones show as
 * `null` — which reads as "the document does not say", never as zero.
 */
export function toPlanOptionDto(planOption: PlanOptionWithRelations): PlanOptionDto {
  const valuesByFieldId = new Map(planOption.values.map((value) => [value.optionFieldId, value]));

  /** Which answers were ticked, grouped by the setting they belong to. */
  const tickedByFieldId = new Map<string, string[]>();
  for (const row of planOption.selectedChoices) {
    const ticked = tickedByFieldId.get(row.optionFieldId) ?? [];
    ticked.push(row.choiceId);
    tickedByFieldId.set(row.optionFieldId, ticked);
  }

  /**
   * One entry per TOP-LEVEL setting. A condition's own inputs are nested under
   * it as `subValues` rather than listed beside it, so the card can render the
   * toggle and everything it reveals as one unit.
   */
  const topLevel = planOption.option.fields.filter((field) => field.parentFieldId === null);
  const inputsByCondition = new Map<string, typeof planOption.option.fields>();
  for (const field of planOption.option.fields) {
    if (!field.parentFieldId) continue;
    const inputs = inputsByCondition.get(field.parentFieldId) ?? [];
    inputs.push(field);
    inputsByCondition.set(field.parentFieldId, inputs);
  }

  const toValue = (field: (typeof planOption.option.fields)[number]): PlanOptionValueDto => {
    const row = valuesByFieldId.get(field.id);
    const value = readValue(field, row);
    /**
     * The setting's own answers. Sent with the value because a RANK or MULTI
     * value CANNOT be rendered or ranked without them — an id on its own is
     * unreadable — and because a TEXT setting offers them as suggestions.
     */
    const choices = toChoiceDtos(field.choices);
    const offersChoices =
      field.dataType === 'RANK' || field.dataType === 'MULTI' || field.dataType === 'TEXT';

    return {
      id: row?.id ?? '',
      optionFieldId: field.id,
      fieldKey: field.key,
      fieldLabel: field.label,
      dataType: field.dataType,
      unit: field.unit,
      value,
      /**
       * A ROW IS THE TOGGLE.
       *
       * Its presence says the document states this condition — with a figure,
       * or with the figure still blank because none was given. Its absence says
       * the document never mentioned it. Neither of those is zero, and a core
       * field is always applicable so it always reads `true`.
       */
      isEnabled: field.isOptional ? row !== undefined : true,
      isOptional: field.isOptional,
      isRequired: field.isRequired,
      showWhenChoiceId: field.showWhenChoiceId,
      customerTypes: field.customerTypes,
      ...(offersChoices ? { choices } : {}),
      // Resolved here so no client has to join a list to show a row.
      ...(field.dataType === 'RANK'
        ? { choiceLabel: rankLabel(typeof value === 'string' ? value : null, choices) }
        : {}),
      ...(field.dataType === 'MULTI'
        ? { selectedChoiceIds: tickedByFieldId.get(field.id) ?? [] }
        : {}),
      // The boxes this condition reveals when it is switched on.
      ...(inputsByCondition.has(field.id)
        ? { subValues: (inputsByCondition.get(field.id) ?? []).map(toValue) }
        : {}),
    };
  };

  const values: PlanOptionValueDto[] = topLevel.map(toValue);

  return {
    id: planOption.id,
    planConfigurationId: planOption.planConfigurationId,
    optionId: planOption.optionId,
    optionName: planOption.option.name,
    /**
     * Copied from the benefit so a client can nest sub-benefits under their
     * group without fetching the catalogue as well. An umbrella has no
     * settings, so `values` below is empty for it — the value lives on its
     * children.
     */
    isUmbrella: planOption.option.isUmbrella,
    parentOptionId: planOption.option.parentId,
    note: planOption.note,
    sortOrder: planOption.sortOrder,
    createdAt: toIso(planOption.createdAt),
    updatedAt: toIso(planOption.updatedAt),
    values,
  };
}

/** Include clause that satisfies `PlanOptionWithRelations`. */
export const planOptionInclude = {
  option: {
    include: {
      fields: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' as const },
        include: {
          choices: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
        },
      },
    },
  },
  values: true,
  selectedChoices: true,
} as const;
