import {
  SME_FIXED_AVERAGE_AGE_NOTICE,
  formatAverageAgeLabel,
  listComparisonSteps,
  type ComparisonCriteriaInput,
  type CustomerTypeOption,
} from '@aggregator/shared';
import { OptionCardGroup } from '@/components/ui';
import { getOptionsForSource } from './comparison-options';

/**
 * Renders the comparison selection screen from `listComparisonSteps()`.
 * Nothing here is hardcoded: headings, order and options all come from the
 * shared configuration.
 */
export function ComparisonCriteriaForm({
  criteria,
  onChange,
  errorsByField,
}: {
  criteria: ComparisonCriteriaInput;
  onChange: <TField extends keyof ComparisonCriteriaInput>(
    field: TField,
    value: ComparisonCriteriaInput[TField],
  ) => void;
  errorsByField: Partial<Record<keyof ComparisonCriteriaInput, string>>;
}) {
  return (
    <div className="space-y-10">
      {listComparisonSteps().map((step) => (
        <OptionCardGroup
          key={step.id}
          name={step.id}
          legend={step.title}
          {...(step.description !== undefined ? { hint: step.description } : {})}
          options={getOptionsForSource(step.optionSource)}
          value={criteria[step.field]}
          onChange={(id) => onChange(step.field, id as ComparisonCriteriaInput[typeof step.field])}
          error={errorsByField[step.field] ?? null}
          columns={step.optionSource === 'GEOGRAPHICAL_COVERAGES' ? 2 : 3}
          {...(step.optionSource === 'CUSTOMER_TYPES'
            ? { renderNote: renderCustomerTypeNote }
            : {})}
        />
      ))}
    </div>
  );
}

/**
 * Explains a fixed-average-age customer type (currently SME) directly on its
 * card. The value and the wording both come from the shared business rules.
 */
function renderCustomerTypeNote(option: { id: string }) {
  const customerType = option as CustomerTypeOption;
  if (customerType.ageInputMode !== 'FIXED_AVERAGE' || customerType.fixedAverageAge === null) {
    return null;
  }
  return `${SME_FIXED_AVERAGE_AGE_NOTICE} ${formatAverageAgeLabel(customerType.fixedAverageAge)}.`;
}
