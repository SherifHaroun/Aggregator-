import type { PlanOptionDto, PlanOptionValueDto } from '@aggregator/shared';
import type {
  InsuranceOption,
  Limitation,
  OptionChoice,
  OptionField,
  PlanOption,
  PlanOptionLimitation,
  PlanOptionValue,
} from '@prisma/client';
import { rankLabel } from '@aggregator/shared';
import { toIso } from '../../lib/decimal.js';
import { toLimitationDto } from '../limitations/limitations.service.js';
import { toOptionChoiceDto } from '../insurance-options/option-choices.service.js';
import { readValue } from './plan-option-values.js';

export type PlanOptionWithRelations = PlanOption & {
  option: InsuranceOption & { fields: OptionField[]; choices: OptionChoice[] };
  values: PlanOptionValue[];
  limitations: (PlanOptionLimitation & { limitation: Limitation })[];
};

/**
 * Produce one entry per ACTIVE field of the option, whether or not the plan has
 * supplied a value. The frontend can therefore render the form for any option
 * without knowing which fields exist, and unconfigured fields show as `null`.
 */
export function toPlanOptionDto(planOption: PlanOptionWithRelations): PlanOptionDto {
  const valuesByFieldId = new Map(planOption.values.map((value) => [value.optionFieldId, value]));

  /**
   * The answers this benefit offers, sent alongside any field that can use
   * them. A RANK value is stored as an id and CANNOT be rendered or ranked
   * without them; a TEXT value merely suggests from them.
   */
  const choices = planOption.option.choices.map(toOptionChoiceDto);

  const values: PlanOptionValueDto[] = planOption.option.fields.map((field) => {
    const row = valuesByFieldId.get(field.id);
    const value = readValue(field, row);
    const offersChoices = field.dataType === 'RANK' || field.dataType === 'TEXT';

    return {
      id: row?.id ?? '',
      optionFieldId: field.id,
      fieldKey: field.key,
      fieldLabel: field.label,
      dataType: field.dataType,
      unit: field.unit,
      value,
      ...(offersChoices ? { choices } : {}),
      // Resolved here so no client has to join a list to show a row.
      ...(field.dataType === 'RANK'
        ? { choiceLabel: rankLabel(typeof value === 'string' ? value : null, choices) }
        : {}),
    };
  });

  return {
    id: planOption.id,
    planConfigurationId: planOption.planConfigurationId,
    optionId: planOption.optionId,
    optionName: planOption.option.name,
    /**
     * Copied from the benefit so a client can nest sub-benefits under their
     * group without fetching the catalogue as well. An umbrella has no fields,
     * so `values` below is empty for it — the value lives on its children.
     */
    isUmbrella: planOption.option.isUmbrella,
    parentOptionId: planOption.option.parentId,
    note: planOption.note,
    /**
     * Ordered as the catalogue orders itself, so the same set of restrictions
     * always reads the same way — on the row, on a rival plan's row, and in the
     * comparison. An empty list is unrestricted cover, not missing data.
     */
    limitations: planOption.limitations.map((row) => toLimitationDto(row.limitation)),
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
      fields: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
      choices: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
    },
  },
  values: true,
  limitations: {
    include: { limitation: true },
    orderBy: { limitation: { sortOrder: 'asc' as const } },
  },
} as const;
