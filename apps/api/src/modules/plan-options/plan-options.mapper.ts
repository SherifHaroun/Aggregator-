import type { PlanOptionDto, PlanOptionValueDto } from '@aggregator/shared';
import type { InsuranceOption, OptionField, PlanOption, PlanOptionValue } from '@prisma/client';
import { toIso } from '../../lib/decimal.js';
import { readValue } from './plan-option-values.js';

export type PlanOptionWithRelations = PlanOption & {
  option: InsuranceOption & { fields: OptionField[] };
  values: PlanOptionValue[];
};

/**
 * Produce one entry per ACTIVE field of the option, whether or not the plan has
 * supplied a value. The frontend can therefore render the form for any option
 * without knowing which fields exist, and unconfigured fields show as `null`.
 */
export function toPlanOptionDto(planOption: PlanOptionWithRelations): PlanOptionDto {
  const valuesByFieldId = new Map(planOption.values.map((value) => [value.optionFieldId, value]));

  const values: PlanOptionValueDto[] = planOption.option.fields.map((field) => {
    const row = valuesByFieldId.get(field.id);
    return {
      id: row?.id ?? '',
      optionFieldId: field.id,
      fieldKey: field.key,
      fieldLabel: field.label,
      dataType: field.dataType,
      unit: field.unit,
      value: readValue(field, row),
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
    sortOrder: planOption.sortOrder,
    createdAt: toIso(planOption.createdAt),
    updatedAt: toIso(planOption.updatedAt),
    values,
  };
}

/** Include clause that satisfies `PlanOptionWithRelations`. */
export const planOptionInclude = {
  option: { include: { fields: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } } },
  values: true,
} as const;
