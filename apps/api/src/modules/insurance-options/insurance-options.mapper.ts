import type { InsuranceOptionDto, OptionFieldDto } from '@aggregator/shared';
import type { InsuranceOption, OptionField } from '@prisma/client';
import { toIso } from '../../lib/decimal.js';

export function toOptionFieldDto(field: OptionField): OptionFieldDto {
  return {
    id: field.id,
    optionId: field.optionId,
    label: field.label,
    key: field.key,
    dataType: field.dataType,
    unit: field.unit,
    helpText: field.helpText,
    isRequired: field.isRequired,
    sortOrder: field.sortOrder,
    isActive: field.isActive,
    createdAt: toIso(field.createdAt),
    updatedAt: toIso(field.updatedAt),
  };
}

export type InsuranceOptionWithRelations = InsuranceOption & {
  fields?: OptionField[];
  children?: InsuranceOptionWithRelations[];
};

export function toInsuranceOptionDto(option: InsuranceOptionWithRelations): InsuranceOptionDto {
  return {
    id: option.id,
    name: option.name,
    description: option.description,
    sortOrder: option.sortOrder,
    isUmbrella: option.isUmbrella,
    parentId: option.parentId,
    isActive: option.isActive,
    createdAt: toIso(option.createdAt),
    updatedAt: toIso(option.updatedAt),
    ...(option.fields ? { fields: option.fields.map(toOptionFieldDto) } : {}),
    ...(option.children ? { children: option.children.map(toInsuranceOptionDto) } : {}),
  };
}
