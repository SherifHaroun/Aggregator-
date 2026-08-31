import {
  BENEFIT_DETAIL_PLACEHOLDER,
  CORE_MEDICAL_BENEFITS,
  GEOGRAPHICAL_COVERAGES,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  OPTIONAL_MEDICAL_BENEFITS,
  UNSPECIFIED_OPTION_LABEL,
  listEnabledOptions,
  medicalBenefitSpec,
  variantDisplayName,
  type CompanyMedicalNetworkDto,
  type GeographicalCoverageId,
  type MedicalBenefitSpec,
} from '@aggregator/shared';
import { useState } from 'react';
import {
  Button,
  Dialog,
  Field,
  IconAdd,
  IconLock,
  IconTrash,
  Input,
  NumberInput,
  Select,
} from '@/components/ui';
import { emptyEntry, type BenefitEntry, type VariantDraft } from './variant-draft';

/** What a benefit already carries, when it is already in the catalogue. */
export type ExistingKind = { dataType: string; unit: string | null };

/**
 * One variant of a plan: what it covers, on which network, at what ceiling,
 * with its own benefits and its own premium per age band.
 *
 * The name is not typed. It is the plan's name and the coverage read together
 * — "Gold+ Local" — so it cannot disagree with the fields it is made of, and
 * renaming the plan renames every variant at once.
 */
export function VariantEditor({
  planName,
  position,
  variant,
  networks,
  currency,
  existingKinds,
  onChange,
  onRemove,
}: {
  planName: string;
  position: number;
  variant: VariantDraft;
  networks: CompanyMedicalNetworkDto[];
  currency: string;
  existingKinds: Map<string, ExistingKind>;
  onChange: (patch: Partial<VariantDraft>) => void;
  /** Absent on the first variant: a plan sold no way at all is not a plan. */
  onRemove?: () => void;
}) {
  const [picking, setPicking] = useState(false);

  const shown: MedicalBenefitSpec[] = [
    ...CORE_MEDICAL_BENEFITS,
    ...variant.extras.flatMap((name) => {
      const spec = medicalBenefitSpec(name);
      return spec ? [spec] : [];
    }),
  ];

  const displayName = variantDisplayName(planName, variant.geographicalCoverage);

  function setEntry(benefit: string, patch: Partial<BenefitEntry>) {
    onChange({
      entries: {
        ...variant.entries,
        [benefit]: { ...(variant.entries[benefit] ?? emptyEntry()), ...patch },
      },
    });
  }

  function addExtras(names: string[]) {
    const entries = { ...variant.entries };
    for (const name of names) entries[name] ??= emptyEntry();
    onChange({
      extras: [...variant.extras, ...names.filter((name) => !variant.extras.includes(name))],
      entries,
    });
    setPicking(false);
  }

  return (
    <section className="border-border-subtle rounded-(--radius-card) border">
      <header className="border-border-subtle bg-surface-muted/50 flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-content-subtle text-xs font-semibold tracking-[0.08em] uppercase">
            Variant {position}
          </p>
          <p className="text-content truncate text-sm font-semibold">
            {displayName || 'Name the plan above'}
          </p>
        </div>
        {onRemove ? (
          <Button variant="secondary" onClick={onRemove}>
            <IconTrash className="size-4" />
            Remove variant
          </Button>
        ) : null}
      </header>

      <div className="space-y-6 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coverage" required hint="What this variant covers, and what names it.">
            {(props) => (
              <Select
                {...props}
                value={variant.geographicalCoverage}
                onChange={(event) =>
                  onChange({
                    geographicalCoverage: event.target.value as GeographicalCoverageId,
                  })
                }
              >
                {listEnabledOptions(GEOGRAPHICAL_COVERAGES).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/* Never typed: it is the plan's name and the coverage, read
              together. Shown so the employee sees what the variant will be
              called, and locked so the two can never disagree. */}
          <Field
            label="Variant name"
            hint="Made from the plan name and the coverage — it updates itself."
          >
            {(props) => (
              <div className="relative">
                <Input
                  {...props}
                  value={displayName}
                  readOnly
                  disabled
                  className="pr-10 opacity-80"
                />
                <span
                  aria-hidden
                  className="text-content-subtle pointer-events-none absolute inset-y-0 right-3 flex items-center"
                >
                  <IconLock className="size-4" />
                </span>
              </div>
            )}
          </Field>

          <Field
            label="Medical network"
            hint={
              networks.length === 0
                ? 'This company has no networks yet. Add them on the company screen.'
                : 'This company’s own list. Another insurer’s is never on offer.'
            }
          >
            {(props) => (
              <Select
                {...props}
                value={variant.medicalNetworkId}
                disabled={networks.length === 0}
                onChange={(event) => onChange({ medicalNetworkId: event.target.value })}
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

          <Field
            label="Annual / in-patient limit"
            required
            hint="The ceiling. The same plan at another ceiling is another variant."
          >
            {(props) => (
              <NumberInput
                {...props}
                value={variant.annualLimit}
                onChange={(value) => onChange({ annualLimit: value })}
                suffix={currency}
                placeholder="600,000"
              />
            )}
          </Field>
        </div>

        {/* ---------------------------------------------------------------- */}
        <div className="space-y-3">
          <SubTitle>Core benefits</SubTitle>
          <div className="border-border-subtle divide-border-subtle divide-y rounded-(--radius-card) border">
            <div className="text-content-subtle grid grid-cols-[1fr_auto] gap-4 px-4 py-2 text-xs font-semibold tracking-wide uppercase sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_7rem]">
              <span>Benefit</span>
              <span className="hidden sm:block">Coverage</span>
              <span className="text-right sm:text-left">Co-payment</span>
            </div>
            {CORE_MEDICAL_BENEFITS.map((spec) => (
              <BenefitRow
                key={spec.name}
                spec={spec}
                existing={existingKinds.get(spec.name.trim().toLowerCase()) ?? null}
                entry={variant.entries[spec.name] ?? emptyEntry()}
                onChange={(patch) => setEntry(spec.name, patch)}
              />
            ))}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        <div className="space-y-3">
          <SubTitle>Optional benefits</SubTitle>
          <p className="text-content-subtle -mt-1 text-sm">
            Only what THIS variant states. Another variant of the same plan may state none of them.
          </p>

          {variant.extras.length > 0 ? (
            <div className="border-border-subtle divide-border-subtle divide-y rounded-(--radius-card) border">
              {variant.extras.map((name) => {
                const spec = medicalBenefitSpec(name);
                if (!spec) return null;
                const entry = variant.entries[spec.name] ?? emptyEntry();
                const kind = existingKinds.get(spec.name.trim().toLowerCase()) ?? null;
                const numeric =
                  kind !== null && kind.dataType !== 'TEXT' && kind.dataType !== 'RANK';
                return (
                  <div
                    key={spec.name}
                    className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] sm:items-center"
                  >
                    <span className="text-content flex items-center gap-2.5 text-sm font-medium">
                      <span aria-hidden className="text-lg leading-none">
                        {spec.emoji}
                      </span>
                      {spec.name}
                    </span>

                    {numeric ? (
                      <NumberInput
                        aria-label={`${spec.name} detail`}
                        value={entry.coverage}
                        suffix={kind?.unit ?? undefined}
                        onChange={(value) => setEntry(spec.name, { coverage: value })}
                        placeholder={UNSPECIFIED_OPTION_LABEL}
                      />
                    ) : (
                      <Input
                        aria-label={`${spec.name} detail`}
                        value={entry.coverage}
                        onChange={(event) => setEntry(spec.name, { coverage: event.target.value })}
                        placeholder={BENEFIT_DETAIL_PLACEHOLDER}
                      />
                    )}

                    <button
                      type="button"
                      aria-label={`Remove ${spec.name}`}
                      className="text-content-subtle hover:text-danger justify-self-end rounded p-1.5"
                      onClick={() =>
                        onChange({ extras: variant.extras.filter((item) => item !== spec.name) })
                      }
                    >
                      <IconTrash className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <Button type="button" variant="secondary" onClick={() => setPicking(true)}>
            <IconAdd className="size-4" />
            Add benefit
          </Button>
        </div>

        {/* ---------------------------------------------------------------- */}
        <div className="space-y-3">
          <SubTitle>Age pricing</SubTitle>
          <p className="text-content-subtle -mt-1 text-sm">
            This variant’s own premiums. Leave one blank and it is simply not sold at those ages.
          </p>

          <div className="border-border-subtle divide-border-subtle divide-y rounded-(--radius-card) border">
            <div className="text-content-subtle grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-2 text-xs font-semibold tracking-wide uppercase">
              <span>Age range</span>
              <span>Annual premium</span>
              <span className="w-8" />
            </div>

            {variant.bands.map((band, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 px-4 py-2"
              >
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Variant ${position} age from, band ${index + 1}`}
                    value={band.from}
                    inputMode="numeric"
                    className="w-16 text-center"
                    onChange={(event) =>
                      onChange({
                        bands: variant.bands.map((row, i) =>
                          i === index ? { ...row, from: event.target.value } : row,
                        ),
                      })
                    }
                  />
                  <span className="text-content-subtle">–</span>
                  <Input
                    aria-label={`Variant ${position} age to, band ${index + 1}`}
                    value={band.to}
                    inputMode="numeric"
                    className="w-16 text-center"
                    onChange={(event) =>
                      onChange({
                        bands: variant.bands.map((row, i) =>
                          i === index ? { ...row, to: event.target.value } : row,
                        ),
                      })
                    }
                  />
                </div>

                <NumberInput
                  aria-label={`Variant ${position} premium, ages ${band.from} to ${band.to}`}
                  value={band.premium}
                  suffix={currency}
                  placeholder="Not covered"
                  onChange={(value) =>
                    onChange({
                      bands: variant.bands.map((row, i) =>
                        i === index ? { ...row, premium: value } : row,
                      ),
                    })
                  }
                />

                <button
                  type="button"
                  aria-label={`Variant ${position} remove band ${band.from}–${band.to}`}
                  className="text-content-subtle hover:text-danger rounded p-1.5"
                  onClick={() =>
                    onChange({ bands: variant.bands.filter((_, i) => i !== index) })
                  }
                >
                  <IconTrash className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => onChange({ bands: [...variant.bands, { from: '', to: '', premium: '' }] })}
          >
            <IconAdd className="size-4" />
            Add age band
          </Button>
          <p className="text-content-subtle text-xs">
            Ages run from {MIN_INSURABLE_AGE} to {MAX_INSURABLE_AGE}.
          </p>
        </div>
      </div>

      {picking ? (
        <BenefitPicker
          already={[...CORE_MEDICAL_BENEFITS.map((item) => item.name), ...variant.extras]}
          onCancel={() => setPicking(false)}
          onAdd={addExtras}
        />
      ) : null}
    </section>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-content-subtle text-xs font-semibold tracking-[0.08em] uppercase">
      {children}
    </h4>
  );
}

/**
 * One core benefit: what it covers, any co-payment, and the lines the plan
 * states about it.
 *
 * Only the coverage box reaches a comparison. The co-payment and the details
 * are shown wherever the plan is read — which is what makes it safe to record
 * "10 sessions per year" without it pretending to be cover.
 */
function BenefitRow({
  spec,
  existing,
  entry,
  onChange,
}: {
  spec: MedicalBenefitSpec;
  existing: ExistingKind | null;
  entry: BenefitEntry;
  onChange: (patch: Partial<BenefitEntry>) => void;
}) {
  /**
   * The box follows the benefit, not the other way round. A benefit already in
   * the catalogue keeps whatever it carries; only a brand-new one takes the
   * kind this form would create it with.
   */
  const numeric = existing
    ? existing.dataType !== 'TEXT' && existing.dataType !== 'RANK'
    : spec.valueKind === 'LIMIT';

  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_7rem] sm:items-center">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="text-lg leading-none">
            {spec.emoji}
          </span>
          <span className="text-content text-sm font-medium">{spec.name}</span>
        </div>

        {numeric ? (
          <NumberInput
            aria-label={`${spec.name} coverage`}
            value={entry.coverage}
            onChange={(value) => onChange({ coverage: value })}
            suffix={existing?.unit ?? undefined}
            placeholder={UNSPECIFIED_OPTION_LABEL}
          />
        ) : (
          <Input
            aria-label={`${spec.name} coverage`}
            value={entry.coverage}
            onChange={(event) => onChange({ coverage: event.target.value })}
            placeholder={UNSPECIFIED_OPTION_LABEL}
          />
        )}

        {spec.coPayment ? (
          <NumberInput
            aria-label={`${spec.name} co-payment`}
            value={entry.coPayment}
            onChange={(value) => onChange({ coPayment: value })}
            suffix="%"
            placeholder="None"
          />
        ) : (
          <span className="text-content-subtle text-sm">—</span>
        )}
      </div>

      {entry.details.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5 sm:pl-8">
          {entry.details.map((line, index) => (
            <li key={index} className="flex items-center gap-2">
              <span aria-hidden className="text-content-subtle text-xs">
                &bull;
              </span>
              <Input
                aria-label={`${spec.name} detail ${index + 1}`}
                value={line}
                onChange={(event) =>
                  onChange({
                    details: entry.details.map((line_, i) =>
                      i === index ? event.target.value : line_,
                    ),
                  })
                }
                placeholder={BENEFIT_DETAIL_PLACEHOLDER}
                className="text-sm"
              />
              <button
                type="button"
                aria-label={`Remove ${spec.name} detail ${index + 1}`}
                className="text-content-subtle hover:text-danger rounded p-1.5"
                onClick={() => onChange({ details: entry.details.filter((_, i) => i !== index) })}
              >
                <IconTrash className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        className="text-content-subtle hover:text-brand mt-2 inline-flex items-center gap-1.5 text-xs font-medium sm:ml-8"
        onClick={() => onChange({ details: [...entry.details, ''] })}
      >
        <IconAdd className="size-3.5" />
        Add detail
      </button>
    </div>
  );
}

/** Tick the benefits this VARIANT states. */
function BenefitPicker({
  already,
  onCancel,
  onAdd,
}: {
  already: string[];
  onCancel: () => void;
  onAdd: (names: string[]) => void;
}) {
  const [ticked, setTicked] = useState<string[]>([]);
  const available = OPTIONAL_MEDICAL_BENEFITS.filter((spec) => !already.includes(spec.name));

  return (
    <Dialog
      open
      onClose={onCancel}
      title="Add optional benefit"
      description="Only what this variant actually states."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onAdd(ticked)} disabled={ticked.length === 0}>
            Add selected
          </Button>
        </>
      }
    >
      {available.length === 0 ? (
        <p className="text-content-subtle text-sm">Every benefit is already on this variant.</p>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2">
          {available.map((spec) => (
            <label
              key={spec.name}
              className="hover:bg-surface-muted/60 flex cursor-pointer items-center gap-2.5 rounded-(--radius-control) px-2.5 py-2"
            >
              <input
                type="checkbox"
                className="accent-brand size-4"
                checked={ticked.includes(spec.name)}
                onChange={(event) =>
                  setTicked((current) =>
                    event.target.checked
                      ? [...current, spec.name]
                      : current.filter((item) => item !== spec.name),
                  )
                }
              />
              <span aria-hidden className="text-base leading-none">
                {spec.emoji}
              </span>
              <span className="text-content text-sm">{spec.name}</span>
            </label>
          ))}
        </div>
      )}
    </Dialog>
  );
}
