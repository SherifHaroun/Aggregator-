import type { CustomerTypeId, PlanOptionValueDto } from '@aggregator/shared';
import { memo } from 'react';
import { describeError, useToast } from '@/components/ui';
import { useSavePlanOptionCondition } from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';
import { PlanOptionSettingChoices } from './PlanOptionSettingChoices';
import { PlanOptionValueInline } from './PlanOptionValuesForm';
import { revealedInputs } from './settings';

/**
 * The conditions a benefit MAY carry, shown as toggles.
 *
 * An insurance document states a handful of qualifications and says nothing
 * about the rest. Putting every possible box on screen invites an employee to
 * fill one in — and an empty box filled in with 0 is a claim the document never
 * made. So a condition stays a single line until it is switched on, and only
 * then does it ask for anything.
 *
 * Switching one off removes it and its figures: the document never mentioned
 * it, so nothing should remain that says it did.
 */
export const BenefitConditions = memo(function BenefitConditions({
  planOptionId,
  planConfigurationId,
  optionName,
  conditions,
  customerType,
  disabled = false,
}: {
  planOptionId: string;
  planConfigurationId: string;
  optionName: string;
  /** The benefit's optional settings, in the order they were defined. */
  conditions: PlanOptionValueDto[];
  /** Who this configuration is for — some questions do not apply to everyone. */
  customerType: CustomerTypeId;
  disabled?: boolean;
}) {
  const save = useSavePlanOptionCondition();
  const { notify } = useToast();

  if (conditions.length === 0) return null;

  function toggle(condition: PlanOptionValueDto, enabled: boolean) {
    save.mutate(
      { planOptionId, planConfigurationId, optionFieldId: condition.optionFieldId, enabled },
      { onError: (error) => notify(describeError(error, condition.fieldLabel), 'error') },
    );
  }

  return (
    <div className="mt-4">
      <p className="text-content-subtle mb-2 text-[0.7rem] font-semibold tracking-wide uppercase">
        Additional conditions
      </p>

      <div className="space-y-1">
        {conditions.map((condition) => (
          <Condition
            key={condition.optionFieldId}
            planOptionId={planOptionId}
            planConfigurationId={planConfigurationId}
            optionName={optionName}
            condition={condition}
            customerType={customerType}
            disabled={disabled || save.isPending}
            onToggle={(enabled) => toggle(condition, enabled)}
          />
        ))}
      </div>
    </div>
  );
});

/**
 * One condition: a checkbox, and whatever it reveals.
 *
 * The reveal is a grid row growing from `0fr` to `1fr` rather than an animated
 * height, so nothing is measured in JavaScript and nothing jumps when the
 * content inside changes size.
 */
function Condition({
  planOptionId,
  planConfigurationId,
  optionName,
  condition,
  customerType,
  disabled,
  onToggle,
}: {
  planOptionId: string;
  planConfigurationId: string;
  optionName: string;
  condition: PlanOptionValueDto;
  customerType: CustomerTypeId;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const enabled = condition.isEnabled;
  /**
   * What this condition reveals: its own boxes, plus any that belong to the
   * answer currently chosen. A condition that reveals nothing asks for itself.
   */
  const inputs = revealedInputs(condition, customerType);
  /**
   * Whether the condition itself takes an answer.
   *
   * A BOOLEAN condition that owns inputs is a pure container — the checkbox is
   * already its yes/no, and asking again below it would ask the same question
   * twice. Every other condition carries a real value of its own, and may ALSO
   * reveal boxes under the answer chosen: "Limit applies to" is a dropdown, and
   * picking Other reveals the box that says what it was. Both are drawn.
   */
  const asksForItself =
    (condition.subValues ?? []).length === 0 || condition.dataType !== 'BOOLEAN';

  return (
    <div
      className={cn(
        'rounded-(--radius-control) transition-colors',
        enabled && 'bg-surface-muted/50',
      )}
    >
      <label
        className={cn(
          'flex cursor-pointer items-center gap-2.5 px-1.5 py-1.5 text-sm',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          type="checkbox"
          className="accent-brand size-4"
          checked={enabled}
          disabled={disabled}
          aria-label={`${condition.fieldLabel} for ${optionName}`}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span className={cn('text-content', enabled && 'font-medium')}>{condition.fieldLabel}</span>
      </label>

      {/* Grows from nothing rather than animating a measured height. */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: enabled ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {enabled ? (
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-1.5 pb-2.5 pl-8">
              {asksForItself ? (
                /**
                 * No label: the checkbox above already says "Room type", and
                 * printing it again over the box says one thing twice.
                 */
                <ConditionInput
                  planOptionId={planOptionId}
                  planConfigurationId={planConfigurationId}
                  optionName={optionName}
                  value={condition}
                  hideLabel
                />
              ) : null}

              {inputs.map((input) => (
                <ConditionInput
                  key={input.optionFieldId}
                  planOptionId={planOptionId}
                  planConfigurationId={planConfigurationId}
                  optionName={optionName}
                  value={input}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * One box inside a condition.
 *
 * Left blank on purpose where the document gives no figure — a condition that
 * applies without a stated amount is a real answer, and the box says so by
 * staying empty rather than by being filled with a zero.
 */
function ConditionInput({
  planOptionId,
  planConfigurationId,
  optionName,
  value,
  hideLabel = false,
}: {
  planOptionId: string;
  planConfigurationId: string;
  optionName: string;
  value: PlanOptionValueDto;
  /** True when the condition asks for ITSELF: its checkbox is already the label. */
  hideLabel?: boolean;
}) {
  if (value.dataType === 'MULTI') {
    return (
      <PlanOptionSettingChoices
        planOptionId={planOptionId}
        planConfigurationId={planConfigurationId}
        optionName={optionName}
        value={value}
      />
    );
  }

  return (
    <label className="flex flex-col gap-1">
      {hideLabel ? null : <span className="text-content-subtle text-xs">{value.fieldLabel}</span>}
      <PlanOptionValueInline
        planOptionId={planOptionId}
        planConfigurationId={planConfigurationId}
        optionName={`${optionName} ${value.fieldLabel}`}
        optionFieldId={value.optionFieldId}
        dataType={value.dataType}
        unit={value.unit}
        value={value.value === null ? '' : String(value.value)}
        {...(value.choices ? { choices: value.choices } : {})}
      />
    </label>
  );
}
