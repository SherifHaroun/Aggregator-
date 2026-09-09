import {
  ASSUMED_LIMIT_LABEL,
  BENEFIT_DETAIL_PLACEHOLDER,
  CORE_VALUE_KINDS,
  CORE_VALUE_KIND_IDS,
  CO_PAYMENT_FIELD,
  type CoreValueKindId,
  type InsuranceOptionDto,
  type OptionFieldDto,
} from '@aggregator/shared';
import { Button, IconAdd, IconTrash, Input, NumberInput, Select } from '@/components/ui';

/**
 * WHAT ONE BENEFIT SAYS ON ONE VARIANT, AS THE DOCUMENT SAYS IT.
 *
 * A core area is worth ONE figure, quoted one of two ways: a ceiling in money
 * or a share of the bill. The employee says which and fills it in. Everything
 * else the document adds — waiting periods, member ratios, named exclusions —
 * is a DETAIL LINE: it qualifies the figure rather than competing with it, and
 * it is read when somebody opens a plan rather than when plans are ranked.
 *
 * An additional benefit has no figure at all. Its presence is the statement,
 * and whatever the document says about it is detail.
 */
export interface BenefitDraft {
  /** Which of the two ways this plan quotes the benefit. Core benefits only. */
  kind: CoreValueKindId;
  /** The figure, as typed. Empty means the document did not state one. */
  value: string;
  /**
   * The share the member pays, as a percentage, as typed. Core benefits
   * only. Empty means the document states none — which is no co-payment.
   */
  coPayment: string;
  /** One line per thing the document adds. */
  details: string[];
}

export const emptyBenefitDraft = (kind: CoreValueKindId = 'LIMIT'): BenefitDraft => ({
  kind,
  value: '',
  coPayment: '',
  details: [],
});

/**
 * The field on a record that holds a figure of this kind, if it has one.
 *
 * The co-payment is a percentage too, so it is told apart by its key rather
 * than its type: a coverage area must never read its co-payment as its cover.
 */
export function fieldOfKind(
  option: InsuranceOptionDto | undefined,
  kind: CoreValueKindId,
): OptionFieldDto | undefined {
  return (option?.fields ?? []).find(
    (field) =>
      field.dataType === CORE_VALUE_KINDS[kind].dataType && field.key !== CO_PAYMENT_FIELD.key,
  );
}

/** The co-payment field on a record, if it has one. */
export function coPaymentFieldOf(
  option: InsuranceOptionDto | undefined,
): OptionFieldDto | undefined {
  return (option?.fields ?? []).find((field) => field.key === CO_PAYMENT_FIELD.key);
}

/** Where a core area's co-payment lives — the record and the field — if anywhere. */
export function locateCoPaymentField(
  records: InsuranceOptionDto[],
): { option: InsuranceOptionDto; field: OptionFieldDto } | null {
  for (const option of records) {
    const field = coPaymentFieldOf(option);
    if (field) return { option, field };
  }
  return null;
}

/**
 * Where a benefit's figure of this kind lives — the record and the field.
 *
 * A core area may be a group in the catalogue, in which case the figure is on
 * one of its members: "Dental" holds nothing, and its ceiling is on "Dental
 * Limit". Searched across the group rather than assumed, so the record the
 * catalogue actually has is the one written to.
 */
export function locateValueField(
  records: InsuranceOptionDto[],
  kind: CoreValueKindId,
): { option: InsuranceOptionDto; field: OptionFieldDto } | null {
  for (const option of records) {
    const field = fieldOfKind(option, kind);
    if (field) return { option, field };
  }
  return null;
}

export function CoreBenefitEntry({
  label,
  note,
  currency,
  draft,
  onChange,
  canQuote,
}: {
  label: string;
  /** Names the catalogue record when it differs from the heading. */
  note?: string;
  currency: string | null;
  draft: BenefitDraft;
  onChange: (next: BenefitDraft) => void;
  /**
   * Whether the catalogue can hold this figure yet. A benefit that exists but
   * carries no field of the chosen kind gets one when it is first saved.
   */
  canQuote: boolean;
}) {
  const kind = CORE_VALUE_KINDS[draft.kind];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <p className="text-content font-semibold">{label}</p>
          {note ? <p className="text-content-subtle mt-0.5 text-xs">{note}</p> : null}
        </div>

        {/*
          NOT A CHOICE. Each core area is quoted one way by every plan —
          in-patient as a share of the bill, dental as a ceiling — because a
          comparison can only rank plans that are answering the same question.
        */}
        <div className="w-56">
          <span className="text-content-subtle text-xs font-medium">{kind.fieldLabel}</span>
          <NumberInput
            suffix={kind.unit ?? currency ?? ''}
            value={draft.value}
            aria-label={`${label} ${kind.fieldLabel}`}
            onChange={(value) => onChange({ ...draft, value })}
          />
          {/*
            A zero is the plan declining the area, not the smallest cover. A
            blank ceiling is neither: it is the plan's annual limit, the
            reading insurers' own tables give a covered area with no
            sub-limit, and the comparison marks it as such.
          */}
          <p className="text-content-subtle mt-1 text-xs">
            {draft.value.trim() === '0'
              ? 'Not covered'
              : draft.value.trim() === '' && draft.kind === 'LIMIT'
                ? `Blank means the plan's ${ASSUMED_LIMIT_LABEL}. Enter 0 if the plan does not cover it.`
                : 'Enter 0 if the plan does not cover it.'}
          </p>
        </div>

        {/*
          BESIDE THE FIGURE, THE MEMBER'S SHARE. Every core area carries both:
          "1,500 EGP, 10% co-payment" is one statement, and the comparison
          reads the pair. Blank is the document stating none, which is no
          co-payment — never an unknown.
        */}
        <div className="w-40">
          <span className="text-content-subtle text-xs font-medium">{CO_PAYMENT_FIELD.label}</span>
          <NumberInput
            suffix={CO_PAYMENT_FIELD.unit}
            value={draft.coPayment}
            aria-label={`${label} ${CO_PAYMENT_FIELD.label}`}
            onChange={(coPayment) => onChange({ ...draft, coPayment })}
          />
          <p className="text-content-subtle mt-1 text-xs">
            {draft.coPayment.trim() === '' ? 'Blank means no co-payment.' : 'Paid by the member.'}
          </p>
        </div>
      </div>

      {!canQuote && draft.value.trim() !== '' ? (
        <p className="text-content-subtle mt-1 text-xs">
          “{kind.label}” will be added to this benefit when the variant is saved.
        </p>
      ) : null}

      <BenefitDetails label={label} draft={draft} onChange={onChange} />
    </div>
  );
}

export function AdditionalBenefitEntry({
  label,
  draft,
  onChange,
  onRemove,
}: {
  label: string;
  draft: BenefitDraft;
  onChange: (next: BenefitDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-content font-semibold">{label}</p>
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="text-content-muted hover:bg-surface-muted hover:text-danger rounded-(--radius-control) p-1.5"
        >
          <IconTrash className="size-4" />
        </button>
      </div>

      {/* No figure: an additional benefit is stated by being here at all, and
          whatever the document adds about it is detail. */}
      <BenefitDetails label={label} draft={draft} onChange={onChange} />
    </div>
  );
}

/** The lines a document adds about a benefit, each its own statement. */
function BenefitDetails({
  label,
  draft,
  onChange,
}: {
  label: string;
  draft: BenefitDraft;
  onChange: (next: BenefitDraft) => void;
}) {
  const setDetail = (index: number, text: string) =>
    onChange({
      ...draft,
      details: draft.details.map((line, position) => (position === index ? text : line)),
    });

  return (
    <div className="mt-2 space-y-2">
      {draft.details.map((line, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={line}
            aria-label={`${label} detail ${index + 1}`}
            placeholder={BENEFIT_DETAIL_PLACEHOLDER}
            onChange={(event) => setDetail(index, event.target.value)}
          />
          <button
            type="button"
            aria-label={`Remove ${label} detail ${index + 1}`}
            onClick={() =>
              onChange({
                ...draft,
                details: draft.details.filter((_, position) => position !== index),
              })
            }
            className="text-content-muted hover:bg-surface-muted hover:text-danger shrink-0 rounded-(--radius-control) p-2"
          >
            <IconTrash className="size-4" />
          </button>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ ...draft, details: [...draft.details, ''] })}
      >
        <IconAdd className="size-3.5" />
        Add detail
      </Button>
    </div>
  );
}
