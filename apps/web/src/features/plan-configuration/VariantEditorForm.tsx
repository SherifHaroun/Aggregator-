import {
  DEFAULT_AGE_BANDS,
  GEOGRAPHICAL_COVERAGES,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  UNSPECIFIED_OPTION_LABEL,
  listEnabledOptions,
  variantDisplayName,
  type CompanyMedicalNetworkDto,
  type GeographicalCoverageId,
  type InsuranceOptionDto,
  type OptionFieldDto,
  type PlanConfigurationDto,
  type PlanOptionDto,
} from '@aggregator/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Field,
  IconAdd,
  IconLayers,
  IconTrash,
  Input,
  NumberInput,
  Select,
  StatusToggle,
  describeError,
  useToast,
} from '@/components/ui';
import { keys } from '@/features/insurance-data/insurance-data.api';
import { api } from '@/lib/api-client';
import { AddBenefitDialog } from './AddBenefitDialog';
import {
  BenefitValueField,
  toApiValue,
  toDraftValue,
  type DraftValue,
} from './BenefitValueField';
import {
  isResolved,
  optionalBenefitChoices,
  optionalTargets,
  resolveCoreSections,
  type BenefitValueTarget,
} from './core-benefits';

interface BandDraft {
  key: string;
  from: string;
  to: string;
  premium: string;
}

let nextKey = 0;
const newKey = () => `band-${(nextKey += 1)}`;

/** One drafted value, addressed by the record that holds it and the field. */
const valueKey = (optionId: string, fieldId: string) => `${optionId}::${fieldId}`;

const sameValue = (a: DraftValue, b: DraftValue) =>
  Array.isArray(a) || Array.isArray(b)
    ? JSON.stringify([...(Array.isArray(a) ? a : [])].sort()) ===
      JSON.stringify([...(Array.isArray(b) ? b : [])].sort())
    : a === b;

/**
 * THE WHOLE VARIANT, ON ONE PAGE, IN ONE FORM.
 *
 * What it covers and on what terms, the six core areas every plan is judged on,
 * whichever optional benefits it states, and the premium at every age it is
 * sold at. One Save writes all of it, because they are one document to the
 * person reading it off an insurer's PDF, and making them three screens is how
 * half-entered plans happen.
 *
 * The core areas are LABELS, not records. "In-patient" is this business's
 * heading; the record beneath it is whatever the catalogue already holds —
 * "Inpatient & Daycase" at one company, "Inpatient and daycare Details" at
 * another. Nothing is created to make the headings fit, and an area the
 * catalogue has no record for says so instead.
 */
export function VariantEditorForm({
  variant,
  planName,
  companyId,
  catalogue,
  networks,
}: {
  variant: PlanConfigurationDto;
  planName: string;
  companyId: string;
  catalogue: InsuranceOptionDto[];
  networks: CompanyMedicalNetworkDto[];
}) {
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const sections = useMemo(() => resolveCoreSections(catalogue), [catalogue]);
  const byId = useMemo(() => {
    const map = new Map<string, InsuranceOptionDto>();
    const walk = (option: InsuranceOptionDto) => {
      map.set(option.id, option);
      for (const child of option.children ?? []) walk(child);
    };
    for (const option of catalogue) walk(option);
    return map;
  }, [catalogue]);

  /** Every record the six core areas already occupy — group and members alike. */
  const coreOptionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const section of sections) {
      if (!isResolved(section)) continue;
      ids.add(section.attach.id);
      for (const target of section.targets) ids.add(target.option.id);
    }
    return ids;
  }, [sections]);

  const attachedByOptionId = useMemo(
    () => new Map(variant.options?.map((planOption) => [planOption.optionId, planOption]) ?? []),
    [variant.options],
  );

  // --- draft state, seeded from what the variant already says ---------------

  const seededValues = useMemo(() => {
    const draft: Record<string, DraftValue> = {};
    for (const planOption of variant.options ?? []) {
      const option = byId.get(planOption.optionId);
      for (const field of option?.fields ?? []) {
        const stored = planOption.values.find((value) => value.optionFieldId === field.id);
        draft[valueKey(planOption.optionId, field.id)] = toDraftValue(field, stored);
      }
    }
    return draft;
  }, [variant.options, byId]);

  const seededOptional = useMemo(
    () =>
      (variant.options ?? [])
        .filter(
          (planOption) =>
            planOption.parentOptionId === null && !coreOptionIds.has(planOption.optionId),
        )
        .map((planOption) => planOption.optionId)
        .filter((optionId) => byId.has(optionId)),
    [variant.options, coreOptionIds, byId],
  );

  const seededBands = useMemo(
    () =>
      variant.priceBands.map((band) => ({
        key: newKey(),
        from: String(band.ageFrom),
        to: String(band.ageTo),
        premium: band.annualPrice === null ? '' : String(band.annualPrice),
      })),
    [variant.priceBands],
  );

  const [coverage, setCoverage] = useState<GeographicalCoverageId>(variant.geographicalCoverage);
  const [networkId, setNetworkId] = useState(variant.medicalNetworkId ?? '');
  const [annualLimit, setAnnualLimit] = useState(
    variant.annualLimit === null ? '' : String(variant.annualLimit),
  );
  const [currency, setCurrency] = useState(variant.currency ?? '');
  const [deductible, setDeductible] = useState(
    variant.deductible === null ? '' : String(variant.deductible),
  );
  const [coPayment, setCoPayment] = useState(
    variant.coPayment === null ? '' : String(variant.coPayment),
  );
  const [isActive, setIsActive] = useState(variant.isActive);
  const [values, setValues] = useState<Record<string, DraftValue>>(seededValues);
  const [optional, setOptional] = useState<string[]>(seededOptional);
  const [bands, setBands] = useState<BandDraft[]>(seededBands);

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setError(null);
    setCoverage(variant.geographicalCoverage);
    setNetworkId(variant.medicalNetworkId ?? '');
    setAnnualLimit(variant.annualLimit === null ? '' : String(variant.annualLimit));
    setCurrency(variant.currency ?? '');
    setDeductible(variant.deductible === null ? '' : String(variant.deductible));
    setCoPayment(variant.coPayment === null ? '' : String(variant.coPayment));
    setIsActive(variant.isActive);
    setValues(seededValues);
    setOptional(seededOptional);
    setBands(seededBands);
  }

  const setValue = (optionId: string, fieldId: string, next: DraftValue) => {
    setError(null);
    setValues((current) => ({ ...current, [valueKey(optionId, fieldId)]: next }));
  };
  const readValue = (optionId: string, fieldId: string): DraftValue =>
    values[valueKey(optionId, fieldId)] ?? (/* MULTI seeds as a list */ '');

  // --- age bands ------------------------------------------------------------

  function addBand() {
    setError(null);
    setBands((rows) => {
      const last = rows[rows.length - 1];
      const suggestion = last
        ? { from: Number(last.to) + 1, to: Number(last.to) + 5 }
        : (DEFAULT_AGE_BANDS[0] ?? { from: MIN_INSURABLE_AGE, to: MIN_INSURABLE_AGE });
      const from = Math.min(suggestion.from, MAX_INSURABLE_AGE);
      return [
        ...rows,
        {
          key: newKey(),
          from: String(from),
          to: String(Math.min(Math.max(suggestion.to, from), MAX_INSURABLE_AGE)),
          premium: '',
        },
      ];
    });
  }

  /**
   * The first thing wrong with the rate table, in the order it reads.
   *
   * Bands may not OVERLAP: an age has to fall into exactly one of them, or the
   * premium a customer is quoted depends on which row happened to be read
   * first. The API refuses the same thing — this is so the employee hears it
   * before the request goes.
   */
  function bandProblem(): string | null {
    for (const row of bands) {
      if (row.from.trim() === '' || row.to.trim() === '') return 'Every band needs both ages.';
      const from = Number(row.from);
      const to = Number(row.to);
      if (!Number.isInteger(from) || !Number.isInteger(to)) {
        return 'Enter whole numbers of years.';
      }
      if (from < MIN_INSURABLE_AGE || to > MAX_INSURABLE_AGE) {
        return `Ages run from ${MIN_INSURABLE_AGE} to ${MAX_INSURABLE_AGE}.`;
      }
      if (from > to) return `Ages ${from}–${to} run backwards.`;
    }

    const ordered = [...bands].sort((a, b) => Number(a.from) - Number(b.from));
    for (const [index, row] of ordered.entries()) {
      const previous = ordered[index - 1];
      if (previous && Number(row.from) <= Number(previous.to)) {
        return `Ages ${previous.from}–${previous.to} and ${row.from}–${row.to} overlap. Every age must fall into exactly one band.`;
      }
    }
    return null;
  }

  // --- saving ---------------------------------------------------------------

  async function save() {
    const problem = bandProblem();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      /**
       * The variant's own terms and its whole rate table, in one request. The
       * table is replaced wholesale, so a band removed here is a band the plan
       * no longer sells.
       */
      await api.patch(`/plan-configurations/${variant.id}`, {
        geographicalCoverage: coverage,
        medicalNetworkId: networkId === '' ? null : networkId,
        annualLimit: annualLimit.trim() === '' ? null : Number(annualLimit.replace(/,/g, '')),
        currency: currency.trim() === '' ? null : currency.trim().toUpperCase(),
        deductible: deductible.trim() === '' ? null : Number(deductible.replace(/,/g, '')),
        coPayment: coPayment.trim() === '' ? null : Number(coPayment.replace(/,/g, '')),
        isActive,
        priceBands: bands.map((row) => ({
          ageFrom: Number(row.from),
          ageTo: Number(row.to),
          annualPrice: row.premium.trim() === '' ? null : Number(row.premium.replace(/,/g, '')),
        })),
      });

      // Optional benefits the employee took off this variant.
      for (const optionId of seededOptional) {
        if (optional.includes(optionId)) continue;
        const planOption = attachedByOptionId.get(optionId);
        if (planOption) await api.delete(`/plan-options/${planOption.id}`);
      }

      /**
       * Which records need attaching. A core area is attached when the
       * employee has actually said something about it — an untouched area
       * stays off the variant rather than arriving as a row of blanks.
       */
      const planOptionIdByOptionId = new Map(
        [...attachedByOptionId].map(([optionId, planOption]) => [optionId, planOption.id]),
      );

      const needed = new Set<string>();
      for (const section of sections) {
        if (!isResolved(section)) continue;
        const stated = section.targets.some((target) =>
          [...target.valueFields, ...(target.coPaymentField ? [target.coPaymentField] : [])].some(
            (field) => {
              const draft = readValue(target.option.id, field.id);
              return Array.isArray(draft) ? draft.length > 0 : draft.trim() !== '';
            },
          ),
        );
        if (stated && !planOptionIdByOptionId.has(section.attach.id)) needed.add(section.attach.id);
      }
      for (const optionId of optional) {
        if (!planOptionIdByOptionId.has(optionId)) needed.add(optionId);
      }

      for (const optionId of needed) {
        const attached = await api.post<PlanOptionDto[]>(
          `/plan-configurations/${variant.id}/options`,
          { optionId },
        );
        // Attaching a group brings its members, so record every one returned.
        for (const planOption of attached) {
          planOptionIdByOptionId.set(planOption.optionId, planOption.id);
        }
      }

      // Every value the employee actually changed, and nothing else.
      for (const [key, draft] of Object.entries(values)) {
        const [optionId, fieldId] = key.split('::');
        if (!optionId || !fieldId) continue;
        if (sameValue(draft, seededValues[key] ?? '')) continue;

        const planOptionId = planOptionIdByOptionId.get(optionId);
        if (!planOptionId) continue;

        const field = byId.get(optionId)?.fields?.find((item) => item.id === fieldId);
        if (!field) continue;

        if (field.dataType === 'MULTI') {
          await api.put(`/plan-options/${planOptionId}/settings/${fieldId}/choices`, {
            choiceIds: Array.isArray(draft) ? draft : [],
          });
          continue;
        }
        await api.put(`/plan-options/${planOptionId}/values/${fieldId}`, {
          value: toApiValue(field, draft),
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.planConfigurations }),
        queryClient.invalidateQueries({ queryKey: keys.plans }),
        queryClient.invalidateQueries({ queryKey: keys.insuranceOptions }),
      ]);
      notify('The variant was saved.');
    } catch (saveError) {
      setError(describeError(saveError, 'the variant'));
    } finally {
      setSaving(false);
    }
  }

  const attachedOptionIds = new Set([...coreOptionIds, ...optional]);
  const available = optionalBenefitChoices(catalogue, attachedOptionIds);

  return (
    <div className="space-y-5">
      {error ? (
        <Callout tone="danger" title="Could not save">
          {error}
        </Callout>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader
          title={variantDisplayName(planName, coverage)}
          description="The plan's name and this scope read together. It is never typed, and it follows the plan if the plan is renamed."
        />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Coverage">
            {(props) => (
              <Select
                {...props}
                value={coverage}
                onChange={(event) => setCoverage(event.target.value as GeographicalCoverageId)}
              >
                {listEnabledOptions(GEOGRAPHICAL_COVERAGES).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Medical network"
            hint={
              networks.length === 0
                ? 'This company has no networks yet.'
                : 'From this company’s own list.'
            }
          >
            {(props) => (
              <Select
                {...props}
                value={networkId}
                disabled={networks.length === 0}
                onChange={(event) => setNetworkId(event.target.value)}
              >
                <option value="">{UNSPECIFIED_OPTION_LABEL}</option>
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Annual limit">
            {(props) => (
              <NumberInput {...props} suffix={currency} value={annualLimit} onChange={setAnnualLimit} />
            )}
          </Field>

          <Field label="Currency" hint="Three-letter code.">
            {(props) => (
              <Input
                {...props}
                maxLength={3}
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                placeholder="EGP"
              />
            )}
          </Field>

          {/* Blank means the document did not state one — never a zero. */}
          <Field label="Deductible" hint={NOT_STATED}>
            {(props) => (
              <NumberInput {...props} suffix={currency} value={deductible} onChange={setDeductible} />
            )}
          </Field>

          <Field label="Co-payment" hint={NOT_STATED}>
            {(props) => (
              <NumberInput {...props} suffix="%" value={coPayment} onChange={setCoPayment} />
            )}
          </Field>

          <Field label="Status">
            {(props) => (
              <StatusToggle id={props.id} value={isActive} onChange={setIsActive} />
            )}
          </Field>
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Core benefits"
          description="The six areas every plan is judged on. Blank means the document did not say."
        />
        <CardBody className="divide-y divide-(--color-border)">
          {sections.map((section) => (
            <div key={section.label} className="py-4 first:pt-0 last:pb-0">
              <p className="text-content font-semibold">{section.label}</p>
              {isResolved(section) ? (
                <>
                  {/* Named when it differs, so it is clear WHICH record the
                      heading is editing. */}
                  {section.attach.name !== section.label ? (
                    <p className="text-content-subtle mt-0.5 text-xs">
                      Recorded as “{section.attach.name}”
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-3">
                    {section.targets.map((target) => (
                      <BenefitTargetRow
                        key={target.option.id}
                        target={target}
                        showName={section.targets.length > 1}
                        currency={variant.currency}
                        read={readValue}
                        write={setValue}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-content-muted mt-1 text-sm">
                  No benefit in the catalogue matches this area yet. Add one named{' '}
                  <span className="font-medium">{section.lookedFor[0]}</span> on the Benefits
                  screen and it will appear here.
                </p>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Optional benefits"
          description="Only what this variant actually states. Nothing here is required."
          action={
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <IconAdd className="size-4" />
              Add benefit
            </Button>
          }
        />
        <CardBody>
          {optional.length === 0 ? (
            <p className="text-content-muted text-sm">No optional benefits selected.</p>
          ) : (
            <ul className="divide-y divide-(--color-border)">
              {optional.map((optionId) => {
                const option = byId.get(optionId);
                if (!option) return null;
                return (
                  <li key={optionId} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-content font-semibold">{option.name}</p>
                      <button
                        type="button"
                        aria-label={`Remove ${option.name}`}
                        onClick={() => {
                          setError(null);
                          setOptional((current) => current.filter((id) => id !== optionId));
                        }}
                        className="text-content-muted hover:bg-surface-muted hover:text-danger rounded-(--radius-control) p-1.5"
                      >
                        <IconTrash className="size-4" />
                      </button>
                    </div>
                    <div className="mt-3 space-y-3">
                      {optionalTargets(option).map((target) => (
                        <BenefitTargetRow
                          key={target.option.id}
                          target={target}
                          showName={optionalTargets(option).length > 1}
                          currency={variant.currency}
                          read={readValue}
                          write={setValue}
                        />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Age pricing"
          description="One premium per age band. The cover above is the same for all of them."
          action={
            <Button size="sm" variant="secondary" onClick={addBand}>
              <IconAdd className="size-4" />
              Add age band
            </Button>
          }
        />
        <CardBody>
          {bands.length === 0 ? (
            <p className="text-content-muted text-sm">
              No prices yet. Add the first age band this variant is sold at.
            </p>
          ) : (
            <ul className="space-y-2">
              {bands.map((row) => (
                <li key={row.key} className="flex items-end gap-2">
                  <label className="w-20">
                    <span className="text-content-subtle text-xs font-medium">From</span>
                    <Input
                      type="number"
                      min={MIN_INSURABLE_AGE}
                      max={MAX_INSURABLE_AGE}
                      step={1}
                      value={row.from}
                      aria-label="Age from"
                      onChange={(event) => {
                        setError(null);
                        setBands((rows) =>
                          rows.map((item) =>
                            item.key === row.key ? { ...item, from: event.target.value } : item,
                          ),
                        );
                      }}
                    />
                  </label>
                  <label className="w-20">
                    <span className="text-content-subtle text-xs font-medium">To</span>
                    <Input
                      type="number"
                      min={MIN_INSURABLE_AGE}
                      max={MAX_INSURABLE_AGE}
                      step={1}
                      value={row.to}
                      aria-label="Age to"
                      onChange={(event) => {
                        setError(null);
                        setBands((rows) =>
                          rows.map((item) =>
                            item.key === row.key ? { ...item, to: event.target.value } : item,
                          ),
                        );
                      }}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <span className="text-content-subtle text-xs font-medium">Annual premium</span>
                    <NumberInput
                      suffix={variant.currency ?? ''}
                      value={row.premium}
                      aria-label={`Annual premium for ages ${row.from} to ${row.to}`}
                      onChange={(next) => {
                        setError(null);
                        setBands((rows) =>
                          rows.map((item) =>
                            item.key === row.key ? { ...item, premium: next } : item,
                          ),
                        );
                      }}
                    />
                  </div>
                  {/* Blank is a statement, so it is labelled rather than left
                      looking like an unfinished row. */}
                  <p className="text-content-subtle w-24 pb-2.5 text-xs">
                    {row.premium.trim() === '' ? 'Not covered' : ''}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ages ${row.from} to ${row.to}`}
                    onClick={() => {
                      setError(null);
                      setBands((rows) => rows.filter((item) => item.key !== row.key));
                    }}
                    className="text-content-muted hover:bg-surface-muted hover:text-danger mb-1 rounded-(--radius-control) p-2"
                  >
                    <IconTrash className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={reset} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {adding ? (
        <AddBenefitDialog
          available={available}
          onAdd={(chosen) =>
            setOptional((current) => [...current, ...chosen.map((option) => option.id)])
          }
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * The fields ONE record holds, laid out as the business reads them: what the
 * plan covers, and what the member pays towards it.
 */
function BenefitTargetRow({
  target,
  showName,
  currency,
  read,
  write,
}: {
  target: BenefitValueTarget;
  /** Shown when a section edits more than one record, so rows stay tellable apart. */
  showName: boolean;
  currency: string | null;
  read: (optionId: string, fieldId: string) => DraftValue;
  write: (optionId: string, fieldId: string, next: DraftValue) => void;
}) {
  if (target.valueFields.length === 0 && !target.coPaymentField) {
    return (
      <p className="text-content-subtle text-xs">
        “{target.option.name}” records no value of its own.
      </p>
    );
  }

  const cell = (field: OptionFieldDto) => {
    const id = `f-${target.option.id}-${field.id}`;
    return (
      <div key={field.id}>
        <p id={id} className="text-content-subtle mb-1 text-xs font-medium">
          {field.label}
        </p>
        <BenefitValueField
          field={field}
          labelledBy={id}
          currency={currency}
          value={read(target.option.id, field.id)}
          onChange={(next) => write(target.option.id, field.id, next)}
        />
      </div>
    );
  };

  return (
    <div>
      {showName ? (
        <p className="text-content-muted mb-1.5 flex items-center gap-1.5 text-sm font-medium">
          <IconLayers className="text-content-subtle size-3.5" />
          {target.option.name}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {target.valueFields.map(cell)}
        {target.coPaymentField ? cell(target.coPaymentField) : null}
      </div>
    </div>
  );
}

/** Says what a blank field means, so nobody types a 0 that isn't in the plan. */
const NOT_STATED = 'Leave blank if the plan does not state one.';
