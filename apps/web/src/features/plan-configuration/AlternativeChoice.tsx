import {
  BENEFIT_VALUE_KINDS,
  DEFAULT_BENEFIT_VALUE_KIND,
  listEnabledOptions,
  type BenefitValueKind,
} from '@aggregator/shared';
import { ChoiceGroup } from '@/components/ui';

/**
 * Whether a benefit is quoted TWO WAYS AT ONCE, and what the second way is.
 *
 * Insurance documents do this constantly — "800 EGP, or 80% for basic
 * procedures" — and neither figure is the whole answer, so the benefit carries
 * both and the plan fills in whichever apply.
 *
 * Opt-in, and off by default: most benefits are one figure, and a second empty
 * box on every row of a thirty-benefit plan is noise. The same control serves
 * creating a benefit and editing one, so the question reads identically in
 * both places.
 */
export function AlternativeChoice({
  value,
  onChange,
}: {
  /** The alternative's kind, or `null` when the benefit carries one value. */
  value: BenefitValueKind | null;
  onChange: (kind: BenefitValueKind | null) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="border-border-subtle bg-surface-muted/40 flex cursor-pointer items-start gap-3 rounded-(--radius-control) border p-3">
        <input
          type="checkbox"
          className="accent-brand mt-0.5 size-4"
          checked={value !== null}
          onChange={(event) => onChange(event.target.checked ? DEFAULT_BENEFIT_VALUE_KIND : null)}
        />
        <span>
          <span className="text-content block text-sm font-medium">
            It can also be quoted another way
          </span>
          <span className="text-content-subtle block text-xs leading-snug">
            Adds a second box beside the first, with “or” between them — for cover written as “800
            EGP or 80%”.
          </span>
        </span>
      </label>

      {value !== null ? (
        <ChoiceGroup
          name="alternativeKind"
          legend="What is the alternative?"
          options={listEnabledOptions(BENEFIT_VALUE_KINDS)}
          value={value}
          onChange={(id) => onChange(id as BenefitValueKind)}
        />
      ) : null}
    </div>
  );
}
