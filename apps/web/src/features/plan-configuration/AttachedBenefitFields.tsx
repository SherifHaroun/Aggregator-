import {
  ALTERNATIVE_VALUE_KEY,
  type CustomerTypeId,
  type PlanOptionDto,
  type PlanOptionValueDto,
} from '@aggregator/shared';
import { PlanOptionSettingChoices } from './PlanOptionSettingChoices';
import { PlanOptionValueInline, valueAsText } from './PlanOptionValuesForm';
import { appliesToCustomerType, revealedInputs } from './settings';

/**
 * WHAT ONE ATTACHED BENEFIT SAYS ON ONE VARIANT.
 *
 * Lifted out of the board so the variant editor can render the same fields the
 * board did. That matters more than it sounds: these carry the behaviour that
 * makes structured benefits usable — a waiting period that appears only once
 * it is ticked, "Other" revealing the box that says what the other thing is,
 * a setting that applies to families but not to individuals. Rewriting them
 * flat for a tidier layout would have quietly thrown all of it away.
 *
 * Every box SAVES ITSELF as it is filled in. That is deliberate and older than
 * this file: a benefit is entered while reading a document, and losing a
 * screenful of work to a missed button is the failure worth designing out.
 */

/** A CONDITION is a setting a plan may or may not state — never a core figure. */
export const isCondition = (value: PlanOptionValueDto) => value.isOptional;

/**
 * The core settings a benefit asks for, beyond the figure already shown beside
 * its name.
 *
 * Always visible, because a core field is something the documents state as a
 * matter of course — a dental limit, a coverage percentage, the scope of
 * procedures. Each box saves itself, and each may be left EMPTY: that reads as
 * "the document does not say", and never as zero.
 */
export function BenefitCoreFields({
  planOption,
  customerType,
  disabled,
}: {
  planOption: PlanOptionDto;
  customerType: CustomerTypeId;
  disabled: boolean;
}) {
  const { main, alternative, managed } = splitValues(planOption);

  /**
   * Skip only what the row ALREADY shows.
   *
   * The figure beside the benefit's name is rendered by `BenefitValue`, and
   * only when the benefit carries the one value it manages. A benefit with
   * several core fields shows none of them up there — so excluding the first
   * one here regardless would make it disappear from the card entirely.
   */
  const shownOnRow = managed
    ? new Set([main?.optionFieldId, alternative?.optionFieldId])
    : new Set<string | undefined>();

  const rest = planOption.values.filter(
    (value) =>
      !value.isOptional &&
      !shownOnRow.has(value.optionFieldId) &&
      appliesToCustomerType(value, customerType),
  );
  if (rest.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3 pl-6">
      {rest.flatMap((value) => [
        <CoreField
          key={value.optionFieldId}
          planOption={planOption}
          value={value}
          disabled={disabled}
        />,
        /**
         * What the chosen answer asks for next.
         *
         * "Other" is not an answer on its own — it means "none of these, and
         * here is what it actually is" — so choosing it reveals the box that
         * says. The same mechanism reveals the procedure checklist under
         * "Specific procedures".
         */
        ...revealedInputs(value, customerType).map((input) => (
          <CoreField
            key={input.optionFieldId}
            planOption={planOption}
            value={input}
            disabled={disabled}
          />
        )),
      ])}
    </div>
  );
}

/** One labelled box, saving itself. Blank means the document does not say. */
function CoreField({
  planOption,
  value,
  disabled,
}: {
  planOption: PlanOptionDto;
  value: PlanOptionValueDto;
  disabled: boolean;
}) {
  if (value.dataType === 'MULTI') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-content-subtle text-xs">{value.fieldLabel}</span>
        <PlanOptionSettingChoices
          planOptionId={planOption.id}
          planConfigurationId={planOption.planConfigurationId}
          optionName={planOption.optionName}
          value={value}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-content-subtle text-xs">
        {value.fieldLabel}
        {value.isRequired ? <span className="text-danger ml-0.5">*</span> : null}
      </span>
      <PlanOptionValueInline
        planOptionId={planOption.id}
        planConfigurationId={planOption.planConfigurationId}
        optionName={`${planOption.optionName} ${value.fieldLabel}`}
        optionFieldId={value.optionFieldId}
        dataType={value.dataType}
        unit={value.unit}
        value={value.value === null ? '' : String(value.value)}
        {...(value.choices ? { choices: value.choices } : {})}
        disabled={disabled}
      />
    </label>
  );
}

export function splitValues(planOption: PlanOptionDto): {
  main: PlanOptionValueDto | undefined;
  alternative: PlanOptionValueDto | undefined;
  managed: boolean;
} {
  // Core settings only: a condition is never the figure on the row.
  const core = planOption.values.filter((value) => !value.isOptional);
  const alternative = core.find((value) => value.fieldKey === ALTERNATIVE_VALUE_KEY);
  const main = core.find((value) => value.fieldKey !== ALTERNATIVE_VALUE_KEY);
  const managed = core.length === (alternative ? 2 : 1);
  return { main, alternative, managed };
}

/**
 * What a benefit is worth on this configuration: its value, the alternative it
 * may be quoted as instead, and the remark that qualifies either.
 *
 * The two figures read as one statement — "800 EGP or 80%" — which is how the
 * plan documents write them, so they sit on one line with the word between
 * them rather than in separate fields.
 */
export function BenefitValue({ planOption, pending }: { planOption: PlanOptionDto; pending: boolean }) {
  const { main, alternative, managed } = splitValues(planOption);
  if (!main || !managed) return null;

  return (
    <span className="flex items-center gap-2">
      <PlanOptionValueInline
        planOptionId={planOption.id}
        planConfigurationId={planOption.planConfigurationId}
        optionName={planOption.optionName}
        optionFieldId={main.optionFieldId}
        dataType={main.dataType}
        unit={main.unit}
        value={valueAsText(main)}
        {...(main.choices ? { choices: main.choices } : {})}
        disabled={pending}
      />

      {alternative ? (
        <>
          <span className="text-content-subtle shrink-0 text-xs font-semibold uppercase">or</span>
          <PlanOptionValueInline
            planOptionId={planOption.id}
            planConfigurationId={planOption.planConfigurationId}
            optionName={`${planOption.optionName} alternative`}
            optionFieldId={alternative.optionFieldId}
            dataType={alternative.dataType}
            unit={alternative.unit}
            value={valueAsText(alternative)}
            {...(alternative.choices ? { choices: alternative.choices } : {})}
            disabled={pending}
          />
        </>
      ) : null}
    </span>
  );
}
