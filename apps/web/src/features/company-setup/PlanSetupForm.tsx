import { useMemo, useState } from 'react';
import {
  ALTERNATIVE_VALUE_KEY,
  BENEFIT_DETAIL_PLACEHOLDER,
  BENEFIT_DETAIL_SEPARATOR,
  BENEFIT_INCLUDED_LABEL,
  CO_PAYMENT_FIELD,
  CORE_MEDICAL_BENEFITS,
  DEFAULT_AGE_BANDS,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  OPTIONAL_MEDICAL_BENEFITS,
  UNSPECIFIED_OPTION_LABEL,
  derivePlanCode,
  medicalBenefitSpec,
  type InsuranceOptionDto,
  type MedicalBenefitSpec,
  type OptionFieldDto,
  type Paginated,
  type PlanConfigurationDto,
  type PlanDto,
  type PlanOptionDto,
} from '@aggregator/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Callout,
  Dialog,
  Field,
  IconAdd,
  IconTrash,
  Input,
  NumberInput,
  Select,
  useToast,
} from '@/components/ui';
import { keys, useMedicalNetworks } from '@/features/insurance-data/insurance-data.api';
import { ApiError, api, query } from '@/lib/api-client';
import { describeError } from '@/components/ui/DataState';

/**
 * The medical plan entry form.
 *
 * Shaped by what the legacy system actually did, not by what the schema can
 * hold. Three sections, in the order an employee reads a rate sheet:
 *
 *  1. the plan and its ceiling — the ceiling is part of the product's identity,
 *     because the same plan name sold at two ceilings is two different products
 *     with different benefits;
 *  2. the benefits, one line each — core benefits are always present because
 *     they are what a comparison reads; the rest are added only when a plan
 *     states them;
 *  3. the premium per age band.
 *
 * An age band is a `PlanConfiguration`. The first is created with the benefits
 * attached and valued; the rest are made by `duplicate`, which copies the
 * benefits and their values in a fixed number of statements. That is why the
 * employee fills the benefits in once rather than once per band.
 */

/** Currency for a plan entered here. Egypt is the only market so far. */
const DEFAULT_CURRENCY = 'EGP';

/** What the plan sits under when the form creates the category itself. */
const MEDICAL_TYPE_NAME = 'Medical';

/** Room type suggestions, from the legacy `hb_medical_room_type` lookup. */
const ROOM_TYPES = ['Private Room', 'Suite Room', 'Semi private Room', 'Shared Room'];

interface BenefitEntry {
  /** What the plan covers. The only part a comparison reads. */
  coverage: string;
  /** Percentage as typed. Blank means the plan states no co-payment. */
  coPayment: string;
  /**
   * Lines the plan states about this benefit — shown wherever the plan is
   * read, never scored. Saved as the attachment's note, one line each.
   */
  details: string[];
}

interface BandRow {
  from: string;
  to: string;
  premium: string;
}

const emptyEntry = (): BenefitEntry => ({ coverage: '', coPayment: '', details: [] });

function blankBands(): BandRow[] {
  return DEFAULT_AGE_BANDS.map((band) => ({
    from: String(band.from),
    to: String(band.to),
    premium: '',
  }));
}

const fold = (name: string) => name.trim().toLowerCase();

/**
 * A benefit resolved against the catalogue, ready to attach and value.
 *
 * `attach` is what goes onto the configuration; `valueOptionId` names the row
 * that receives the figure. The two differ only when the name belongs to a
 * benefit group, whose own sub-benefit holds the value.
 */
interface ResolvedBenefit {
  attach: InsuranceOptionDto;
  valueOptionId: string;
  valueFields: OptionFieldDto[];
}

/**
 * What a typed coverage box is worth to a field of this type.
 *
 * `undefined` means the two disagree — wording typed into a benefit that
 * carries a figure — which is reported rather than silently sent as `NaN`.
 */
function coerce(typed: string, dataType: string): string | number | undefined {
  const text = typed.trim();
  if (dataType === 'TEXT') return text;
  const number = Number(text.replace(/,/g, ''));
  return Number.isFinite(number) ? number : undefined;
}

export function PlanSetupForm({
  companyId,
  companyName,
  onCreated,
}: {
  companyId: string;
  companyName?: string;
  onCreated: (planName: string) => void;
}) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const networks = useMedicalNetworks(companyId);

  const [name, setName] = useState('');
  const [medicalNetworkId, setMedicalNetworkId] = useState('');
  const [roomType, setRoomType] = useState('');
  const [annualLimit, setAnnualLimit] = useState('');

  const [entries, setEntries] = useState<Record<string, BenefitEntry>>(() =>
    Object.fromEntries(CORE_MEDICAL_BENEFITS.map((benefit) => [benefit.name, emptyEntry()])),
  );
  /** Optional benefits this plan states, in the order they were added. */
  const [extras, setExtras] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  const [bands, setBands] = useState<BandRow[]>(blankBands);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const shown: MedicalBenefitSpec[] = useMemo(() => {
    const byName = new Map(OPTIONAL_MEDICAL_BENEFITS.map((benefit) => [benefit.name, benefit]));
    return [
      ...CORE_MEDICAL_BENEFITS,
      ...extras.flatMap((extra) => {
        const spec = byName.get(extra);
        return spec ? [spec] : [];
      }),
    ];
  }, [extras]);

  function setEntry(benefit: string, patch: Partial<BenefitEntry>) {
    setEntries((current) => ({
      ...current,
      [benefit]: { ...(current[benefit] ?? emptyEntry()), ...patch },
    }));
  }

  function addExtras(names: string[]) {
    setExtras((current) => [...current, ...names.filter((item) => !current.includes(item))]);
    setEntries((current) => {
      const next = { ...current };
      for (const item of names) next[item] ??= emptyEntry();
      return next;
    });
    setPicking(false);
  }

  function removeExtra(benefit: string) {
    setExtras((current) => current.filter((item) => item !== benefit));
  }

  /** Bands the employee actually priced. A blank premium means "not sold". */
  const pricedBands = bands.filter((band) => band.premium.trim() !== '');

  function validate(): string | null {
    if (name.trim() === '') return 'Enter a plan name.';
    if (annualLimit.trim() === '') return 'Enter the annual limit.';
    if (pricedBands.length === 0) return 'Enter a premium for at least one age band.';

    for (const band of pricedBands) {
      const from = Number(band.from);
      const to = Number(band.to);
      if (!Number.isInteger(from) || !Number.isInteger(to)) {
        return 'Age bands take whole numbers of years.';
      }
      if (from < MIN_INSURABLE_AGE || to > MAX_INSURABLE_AGE || from > to) {
        return `Check the ${band.from}–${band.to} band: ages run from ${MIN_INSURABLE_AGE} to ${MAX_INSURABLE_AGE}, lowest first.`;
      }
    }
    return null;
  }

  /**
   * The benefit as it exists in the global catalogue, created on first use.
   *
   * Benefits are global, so this runs once per benefit for the whole system —
   * not once per plan. The co-payment box is a second field on the benefit,
   * added the same way.
   *
   * WHEN THE NAME ALREADY BELONGS TO A BENEFIT GROUP, the group is used as it
   * stands and the figure goes to the first sub-benefit that can hold one.
   *
   * A catalogue built before this form may well hold "Dental" as a heading over
   * "Dental Limit" and "Dental Coverage", with plans already valued that way.
   * Refusing would make the form unusable until somebody renamed things;
   * inventing a second "Dental" is impossible, since catalogue names are
   * unique. Writing where the existing plans already keep their figures leaves
   * one shape of data rather than two, and the group's own screen keeps working
   * exactly as before.
   */
  async function ensureBenefit(
    spec: MedicalBenefitSpec,
    catalogue: Map<string, InsuranceOptionDto>,
  ): Promise<ResolvedBenefit> {
    const existing = catalogue.get(fold(spec.name));

    if (existing?.isUmbrella) {
      // The sub-benefit that carries a value, in the group's own order.
      const target = (existing.children ?? []).find((child) =>
        (child.fields ?? []).some((field) => field.key !== ALTERNATIVE_VALUE_KEY),
      );
      if (!target) {
        throw new Error(
          `"${spec.name}" is a benefit group with nothing underneath it that holds a value. Add a benefit to that group on the Benefits screen, then add this plan again.`,
        );
      }

      // The sub-benefit gets a co-payment box if it has none, exactly as a
      // benefit created here would. Without it a typed co-payment would have
      // nowhere to go and would be dropped without a word.
      const settledTarget =
        spec.coPayment && !(target.fields ?? []).some((f) => f.key === CO_PAYMENT_FIELD.key)
          ? await (async () => {
              await api.post(`/insurance-options/${target.id}/fields`, {
                label: CO_PAYMENT_FIELD.label,
                key: CO_PAYMENT_FIELD.key,
                dataType: CO_PAYMENT_FIELD.dataType,
                unit: CO_PAYMENT_FIELD.unit,
              });
              return api.get<InsuranceOptionDto>(`/insurance-options/${target.id}`);
            })()
          : target;

      return {
        attach: existing,
        valueOptionId: settledTarget.id,
        valueFields: settledTarget.fields ?? [],
      };
    }

    let option = existing;
    if (!option) {
      option = await api.post<InsuranceOptionDto>('/insurance-options', {
        name: spec.name,
        valueKind: spec.valueKind,
      });
    }

    // Add the co-payment box if this benefit does not carry one yet. Also
    // covers a benefit that existed before this form did.
    const full = await api.get<InsuranceOptionDto>(`/insurance-options/${option.id}`);
    const hasCoPayment = (full.fields ?? []).some((field) => field.key === CO_PAYMENT_FIELD.key);

    if (spec.coPayment && !hasCoPayment) {
      await api.post(`/insurance-options/${full.id}/fields`, {
        label: CO_PAYMENT_FIELD.label,
        key: CO_PAYMENT_FIELD.key,
        dataType: CO_PAYMENT_FIELD.dataType,
        unit: CO_PAYMENT_FIELD.unit,
      });
    }

    const settled = await api.get<InsuranceOptionDto>(`/insurance-options/${full.id}`);
    catalogue.set(fold(spec.name), settled);
    return { attach: settled, valueOptionId: settled.id, valueFields: settled.fields ?? [] };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const issue = validate();
    setFormError(issue);
    if (issue) return;

    setSaving(true);
    try {
      // --- the category the plan is filed under ---------------------------
      setProgress('Preparing…');
      const types = await api.get<Paginated<{ id: string; name: string }>>(
        `/insurance-types${query({ pageSize: 200, isActive: true })}`,
      );
      const medical =
        types.items.find((type) => fold(type.name) === fold(MEDICAL_TYPE_NAME)) ??
        (await api.post<{ id: string }>('/insurance-types', { name: MEDICAL_TYPE_NAME }));

      /**
       * Benefits are settled BEFORE the plan is created.
       *
       * A name clashing with a benefit group, or wording typed into a benefit
       * that carries a figure, both stop the save — and a plan created first
       * would survive as an empty shell nobody asked for. Benefits are global,
       * so anything created here is reusable rather than debris.
       */
      setProgress('Preparing benefits…');
      const page = await api.get<Paginated<InsuranceOptionDto>>(
        `/insurance-options${query({ pageSize: 200 })}`,
      );
      const catalogue = new Map(page.items.map((item) => [fold(item.name), item]));

      /**
       * Which benefits this plan records.
       *
       * A CORE benefit counts once anything is filled in. An OPTIONAL benefit
       * counts because it was PICKED — ticking it is the statement that the
       * plan includes it, and the box beside it only adds wording.
       */
      const stated = shown.filter((spec) => {
        if (extras.includes(spec.name)) return true;
        const entry = entries[spec.name];
        return (
          (entry?.coverage ?? '').trim() !== '' ||
          (entry?.coPayment ?? '').trim() !== '' ||
          (entry?.details ?? []).some((line) => line.trim() !== '')
        );
      });
      const definitions = new Map<string, ResolvedBenefit>();
      for (const spec of stated) {
        const definition = await ensureBenefit(spec, catalogue);
        definitions.set(spec.name, definition);

        // Check the typed coverage against the field that will hold it, while
        // refusing still costs nothing.
        const typed = (entries[spec.name]?.coverage ?? '').trim();
        const field = definition.valueFields.find(
          (item) => item.key !== CO_PAYMENT_FIELD.key && item.key !== ALTERNATIVE_VALUE_KEY,
        );
        if (typed !== '' && field && coerce(typed, field.dataType) === undefined) {
          throw new Error(
            `${spec.name} takes a number, but "${typed}" is not one. Enter a figure, or change what this benefit carries on the Benefits screen.`,
          );
        }
      }

      // --- the plan --------------------------------------------------------
      const plan = await api.post<PlanDto>('/plans', {
        companyId,
        insuranceTypeId: medical.id,
        name: name.trim(),
        code: derivePlanCode(name),
        isActive: true,
      });

      // --- the first age band, with the benefits on it ----------------------
      const [first, ...rest] = pricedBands;
      setProgress(`Saving ages ${first!.from}–${first!.to}…`);
      const configuration = await api.post<PlanConfigurationDto>('/plan-configurations', {
        planId: plan.id,
        customerType: 'INDIVIDUAL',
        geographicalCoverage: 'LOCAL',
        ageFrom: Number(first!.from),
        ageTo: Number(first!.to),
        medicalNetworkId: medicalNetworkId === '' ? null : medicalNetworkId,
        roomType: roomType.trim() === '' ? null : roomType.trim(),
        currency: DEFAULT_CURRENCY,
        annualPrice: Number(first!.premium),
        annualLimit: Number(annualLimit),
        isActive: true,
      });

      for (const spec of stated) {
        const definition = definitions.get(spec.name)!;
        const attached = await api.post<PlanOptionDto[]>(
          `/plan-configurations/${configuration.id}/options`,
          { optionId: definition.attach.id },
        );
        // The row that carries the figure — the group's sub-benefit when the
        // name belongs to a group, otherwise the benefit itself.
        const row = attached.find((item) => item.optionId === definition.valueOptionId);
        if (!row) continue;

        const entry = entries[spec.name] ?? emptyEntry();

        /**
         * An optional benefit records what was typed beside it, and "Covered"
         * when nothing was: ticking it IS the statement that the plan includes
         * the benefit, so it must never be left blank and read later as silence.
         */
        const isExtra = extras.includes(spec.name);
        const written = isExtra
          ? entry.coverage.trim() === ''
            ? BENEFIT_INCLUDED_LABEL
            : entry.coverage.trim()
          : entry.coverage.trim();

        const coverageField = row.values.find((value) => value.fieldKey !== CO_PAYMENT_FIELD.key);
        if (coverageField && written !== '') {
          const value = coerce(written, coverageField.dataType);
          if (value === undefined) {
            throw new Error(
              `${spec.name} takes a number, but "${written}" is not one. Enter a figure, or change what this benefit carries on the Benefits screen.`,
            );
          }
          await api.put(`/plan-options/${row.id}/values/${coverageField.optionFieldId}`, { value });
        }

        const coPaymentField = row.values.find((value) => value.fieldKey === CO_PAYMENT_FIELD.key);
        if (coPaymentField && entry.coPayment.trim() !== '') {
          await api.put(`/plan-options/${row.id}/values/${coPaymentField.optionFieldId}`, {
            value: Number(entry.coPayment),
          });
        }

        /**
         * The detail lines. Display only — the comparison never reads a note,
         * which is exactly why they are safe to record freely.
         */
        const details = entry.details.map((line) => line.trim()).filter((line) => line !== '');
        if (details.length > 0) {
          await api.patch(`/plan-options/${row.id}/note`, {
            note: details.join(BENEFIT_DETAIL_SEPARATOR),
          });
        }
      }

      // --- the remaining bands, benefits and values copied with them --------
      for (const band of rest) {
        setProgress(`Saving ages ${band.from}–${band.to}…`);
        await api.post(`/plan-configurations/${configuration.id}/duplicate`, {
          ageFrom: Number(band.from),
          ageTo: Number(band.to),
          annualPrice: Number(band.premium),
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.plans }),
        queryClient.invalidateQueries({ queryKey: keys.planConfigurations }),
        queryClient.invalidateQueries({ queryKey: keys.insuranceOptions }),
        queryClient.invalidateQueries({ queryKey: keys.insuranceTypes }),
      ]);

      notify(`${plan.name} was added with ${pricedBands.length} age bands.`);
      onCreated(plan.name);

      setName('');
      setAnnualLimit('');
      setRoomType('');
      setEntries(
        Object.fromEntries(CORE_MEDICAL_BENEFITS.map((benefit) => [benefit.name, emptyEntry()])),
      );
      setExtras([]);
      setBands(blankBands());
    } catch (error) {
      // The form raises its own plain Errors for problems it can explain
      // precisely — a name taken by a group, wording typed into a figure.
      // Anything from the API is translated as it is everywhere else.
      setFormError(
        error instanceof ApiError || !(error instanceof Error)
          ? describeError(error, 'the plan')
          : error.message,
      );
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {formError ? (
        <Callout tone="danger" title="Could not save the plan">
          {formError}
        </Callout>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <SectionTitle>Plan and its first variant</SectionTitle>
        <p className="text-content-subtle -mt-2 text-sm">
          A variant is the plan sold one way — on one network, at one ceiling. The same plan sold on
          another network is a second variant, added from the plan afterwards.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Insurance company">
            {(props) => (
              <Input {...props} value={companyName ?? ''} readOnly disabled className="opacity-70" />
            )}
          </Field>

          <Field label="Plan name" required>
            {(props) => (
              <Input
                {...props}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Elite"
              />
            )}
          </Field>

          <Field label="Medical network" hint="Leave blank if the plan does not say.">
            {(props) => (
              <Select
                {...props}
                value={medicalNetworkId}
                onChange={(event) => setMedicalNetworkId(event.target.value)}
              >
                <option value="">{UNSPECIFIED_OPTION_LABEL}</option>
                {(networks.data ?? []).map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Room type" hint="Leave blank if the plan does not say. Never compared.">
            {(props) => (
              <Input
                {...props}
                value={roomType}
                list="room-types"
                onChange={(event) => setRoomType(event.target.value)}
                placeholder={UNSPECIFIED_OPTION_LABEL}
              />
            )}
          </Field>

          <Field
            label="Annual limit"
            required
            hint="The ceiling. Two plans of the same name at different ceilings are different products."
          >
            {(props) => (
              <NumberInput
                {...props}
                value={annualLimit}
                onChange={setAnnualLimit}
                suffix={DEFAULT_CURRENCY}
                placeholder="600,000"
              />
            )}
          </Field>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <SectionTitle>Core benefits</SectionTitle>
        <p className="text-content-subtle -mt-2 text-sm">
          These are what a comparison reads. Leave a coverage box blank where the plan does not say.
        </p>

        <div className="border-border-subtle divide-border-subtle divide-y rounded-(--radius-card) border">
          <div className="text-content-subtle grid grid-cols-[1fr_auto] gap-4 px-4 py-2 text-xs font-semibold tracking-wide uppercase sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_9rem]">
            <span>Benefit</span>
            <span className="hidden sm:block">Coverage</span>
            <span className="text-right sm:text-left">Co-payment</span>
          </div>

          {CORE_MEDICAL_BENEFITS.map((spec) => (
            <BenefitRow
              key={spec.name}
              spec={spec}
              entry={entries[spec.name] ?? emptyEntry()}
              onChange={(patch) => setEntry(spec.name, patch)}
            />
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <SectionTitle>Optional benefits</SectionTitle>
        <p className="text-content-subtle -mt-2 text-sm">
          Picking one records that the plan includes it. The box beside it is for any wording worth
          showing — it is never compared.
        </p>

        {extras.length > 0 ? (
          <div className="border-border-subtle divide-border-subtle divide-y rounded-(--radius-card) border">
            {extras.map((extra) => {
              const spec = medicalBenefitSpec(extra);
              if (!spec) return null;
              const entry = entries[spec.name] ?? emptyEntry();
              const isRoom = spec.name === 'Room Type';
              return (
                <div
                  key={spec.name}
                  className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] sm:items-center"
                >
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden className="text-lg leading-none">
                      {spec.emoji}
                    </span>
                    <span className="text-content text-sm font-medium">{spec.name}</span>
                  </div>

                  <Input
                    aria-label={isRoom ? `${spec.name} coverage` : `${spec.name} detail`}
                    value={entry.coverage}
                    list={isRoom ? 'room-types' : undefined}
                    onChange={(event) => setEntry(spec.name, { coverage: event.target.value })}
                    placeholder={isRoom ? UNSPECIFIED_OPTION_LABEL : BENEFIT_DETAIL_PLACEHOLDER}
                  />

                  <button
                    type="button"
                    aria-label={`Remove ${spec.name}`}
                    className="text-content-subtle hover:text-danger justify-self-end rounded p-1.5"
                    onClick={() => removeExtra(spec.name)}
                  >
                    <IconTrash className="size-4" />
                  </button>
                </div>
              );
            })}
            <datalist id="room-types">
              {ROOM_TYPES.map((room) => (
                <option key={room} value={room} />
              ))}
            </datalist>
          </div>
        ) : null}

        <Button type="button" variant="secondary" onClick={() => setPicking(true)}>
          <IconAdd className="size-4" />
          Add benefit
        </Button>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <SectionTitle>Age pricing</SectionTitle>
        <p className="text-content-subtle -mt-2 text-sm">
          The premium for each band. Leave a premium blank and the plan is simply not sold at those
          ages.
        </p>

        <div className="border-border-subtle divide-border-subtle divide-y rounded-(--radius-card) border">
          <div className="text-content-subtle grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-2 text-xs font-semibold tracking-wide uppercase">
            <span>Age range</span>
            <span>Annual premium</span>
            <span className="w-8" />
          </div>

          {bands.map((band, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 px-4 py-2">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Age from, band ${index + 1}`}
                  value={band.from}
                  inputMode="numeric"
                  className="w-16 text-center"
                  onChange={(event) =>
                    setBands((rows) =>
                      rows.map((row, i) =>
                        i === index ? { ...row, from: event.target.value } : row,
                      ),
                    )
                  }
                />
                <span className="text-content-subtle">–</span>
                <Input
                  aria-label={`Age to, band ${index + 1}`}
                  value={band.to}
                  inputMode="numeric"
                  className="w-16 text-center"
                  onChange={(event) =>
                    setBands((rows) =>
                      rows.map((row, i) => (i === index ? { ...row, to: event.target.value } : row)),
                    )
                  }
                />
              </div>

              <NumberInput
                aria-label={`Premium, ages ${band.from} to ${band.to}`}
                value={band.premium}
                suffix={DEFAULT_CURRENCY}
                placeholder="Not covered"
                onChange={(value) =>
                  setBands((rows) =>
                    rows.map((row, i) => (i === index ? { ...row, premium: value } : row)),
                  )
                }
              />

              <button
                type="button"
                aria-label={`Remove band ${band.from}–${band.to}`}
                className="text-content-subtle hover:text-danger rounded p-1.5"
                onClick={() => setBands((rows) => rows.filter((_, i) => i !== index))}
              >
                <IconTrash className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setBands((rows) => [...rows, { from: '', to: '', premium: '' }])}
        >
          <IconAdd className="size-4" />
          Add age band
        </Button>
      </section>

      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center justify-end gap-3">
        {progress ? <span className="text-content-subtle text-sm">{progress}</span> : null}
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save plan'}
        </Button>
      </div>

      {picking ? (
        <BenefitPicker
          already={[...CORE_MEDICAL_BENEFITS.map((item) => item.name), ...extras]}
          onCancel={() => setPicking(false)}
          onAdd={addExtras}
        />
      ) : null}
    </form>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-content-subtle text-xs font-semibold tracking-[0.08em] uppercase">
      {children}
    </h3>
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
  entry,
  onChange,
}: {
  spec: MedicalBenefitSpec;
  entry: BenefitEntry;
  onChange: (patch: Partial<BenefitEntry>) => void;
}) {
  const setDetail = (index: number, text: string) =>
    onChange({ details: entry.details.map((line, i) => (i === index ? text : line)) });

  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_7rem] sm:items-center">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="text-lg leading-none">
            {spec.emoji}
          </span>
          <span className="text-content text-sm font-medium">{spec.name}</span>
        </div>

        {spec.valueKind === 'LIMIT' ? (
          <NumberInput
            aria-label={`${spec.name} coverage`}
            value={entry.coverage}
            onChange={(value) => onChange({ coverage: value })}
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
                onChange={(event) => setDetail(index, event.target.value)}
                placeholder={BENEFIT_DETAIL_PLACEHOLDER}
                className="text-sm"
              />
              <button
                type="button"
                aria-label={`Remove ${spec.name} detail ${index + 1}`}
                className="text-content-subtle hover:text-danger rounded p-1.5"
                onClick={() =>
                  onChange({ details: entry.details.filter((_, i) => i !== index) })
                }
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

/** Tick the benefits this plan states. */
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
      description="Only what this plan actually states."
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
        <p className="text-content-subtle text-sm">Every benefit is already on this plan.</p>
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
