import { useMemo, useState } from 'react';
import {
  ALTERNATIVE_VALUE_KEY,
  BENEFIT_DETAIL_SEPARATOR,
  BENEFIT_INCLUDED_LABEL,
  CO_PAYMENT_FIELD,
  CORE_MEDICAL_BENEFITS,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  derivePlanCode,
  medicalBenefitLookupNames,
  medicalBenefitSpec,
  variantDisplayName,
  type CustomerTypeId,
  type InsuranceOptionDto,
  type MedicalBenefitSpec,
  type OptionFieldDto,
  type Paginated,
  type PlanConfigurationDto,
  type PlanDto,
  type PlanOptionDto,
} from '@aggregator/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Callout, Field, IconAdd, Input, useToast } from '@/components/ui';
import { describeError } from '@/components/ui/DataState';
import {
  keys,
  useInsuranceOptions,
  useMedicalNetworks,
} from '@/features/insurance-data/insurance-data.api';
import { ApiError, api, query } from '@/lib/api-client';
import { VariantEditor, type ExistingKind } from './VariantEditor';
import { emptyEntry, newVariant, type VariantDraft } from './variant-draft';

/**
 * ONE PLAN, ANY NUMBER OF VARIANTS.
 *
 * A plan is the product and carries only its name. Everything that can differ
 * between the ways it is sold — what it covers, on whose network, at what
 * ceiling, with which benefits and at what premium per age — belongs to a
 * VARIANT. "Gold+ Local" and "Gold+ International" are therefore one Gold+
 * plan with two variants, never two plans with the scope written into their
 * names.
 *
 * Each variant becomes one `PlanConfiguration` per age band it prices: the
 * first is created with the benefits attached and valued, and the rest are made
 * by `duplicate`, which copies them in a fixed number of statements. That is
 * why benefits are filled in once per variant rather than once per band.
 */

/** Currency for a plan entered here. Egypt is the only market so far. */
const DEFAULT_CURRENCY = 'EGP';

/** What the plan sits under when the form creates the category itself. */
const MEDICAL_TYPE_NAME = 'Medical';

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
  customerType,
  onCreated,
}: {
  companyId: string;
  companyName?: string;
  /** The company section this plan is being added to. */
  customerType: CustomerTypeId;
  onCreated: (planName: string) => void;
}) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const networks = useMedicalNetworks(companyId);
  const catalogueQuery = useInsuranceOptions({ isActive: true });

  const [name, setName] = useState('');
  const [variants, setVariants] = useState<VariantDraft[]>(() => [
    newVariant(CORE_MEDICAL_BENEFITS),
  ]);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  /**
   * What each benefit already carries, so a box matches the field it writes to.
   *
   * A benefit already in the catalogue keeps whatever it was created with —
   * "Physiotherapy" may be a percentage from an earlier design. Drawing a text
   * box over it and only discovering the mismatch on save is how an employee
   * loses a screenful of typing.
   */
  const existingKinds = useMemo(() => {
    const byName = new Map<string, ExistingKind>();
    for (const option of catalogueQuery.data ?? []) {
      for (const item of [option, ...(option.children ?? [])]) {
        const field = (item.fields ?? []).find(
          (candidate) =>
            candidate.key !== CO_PAYMENT_FIELD.key && candidate.key !== ALTERNATIVE_VALUE_KEY,
        );
        if (field) byName.set(fold(item.name), { dataType: field.dataType, unit: field.unit });
      }
    }
    return byName;
  }, [catalogueQuery.data]);

  function patchVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((current) =>
      current.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)),
    );
  }

  function addVariant() {
    setVariants((current) => [
      ...current,
      newVariant(
        CORE_MEDICAL_BENEFITS,
        current.map((variant) => variant.geographicalCoverage),
      ),
    ]);
  }

  /** Bands a variant actually priced. A blank premium means "not sold". */
  const priced = (variant: VariantDraft) =>
    variant.bands.filter((band) => band.premium.trim() !== '');

  function validate(): string | null {
    if (name.trim() === '') return 'Enter a plan name.';

    for (const [index, variant] of variants.entries()) {
      const label =
        variantDisplayName(name, variant.geographicalCoverage) || `Variant ${index + 1}`;
      if (variant.annualLimit.trim() === '') return `${label}: enter the annual limit.`;
      if (priced(variant).length === 0) {
        return `${label}: enter a premium for at least one age band.`;
      }
      for (const band of priced(variant)) {
        const from = Number(band.from);
        const to = Number(band.to);
        if (!Number.isInteger(from) || !Number.isInteger(to)) {
          return `${label}: age bands take whole numbers of years.`;
        }
        if (from < MIN_INSURABLE_AGE || to > MAX_INSURABLE_AGE || from > to) {
          return `${label}: check the ${band.from}–${band.to} band — ages run from ${MIN_INSURABLE_AGE} to ${MAX_INSURABLE_AGE}, lowest first.`;
        }
      }
    }

    // Two variants covering the same scope on the same network at the same
    // ceiling are one offering entered twice, and the API would refuse the
    // second. Saying so here costs nothing.
    const seen = new Set<string>();
    for (const variant of variants) {
      const identity = `${variant.geographicalCoverage}|${variant.medicalNetworkId}|${variant.annualLimit.trim()}`;
      if (seen.has(identity)) {
        return 'Two variants have the same coverage, network and limit. Change one of them.';
      }
      seen.add(identity);
    }
    return null;
  }

  /**
   * The benefit as it exists in the global catalogue, created on first use.
   *
   * Benefits are global, so this runs once per benefit for the whole system —
   * not once per plan. When the name already belongs to a BENEFIT GROUP the
   * group is used as it stands and the figure goes to the first sub-benefit
   * that can hold one, because a catalogue built before this form may well keep
   * "Dental" as a heading over "Dental Limit" with plans already valued that
   * way.
   */
  async function ensureBenefit(
    spec: MedicalBenefitSpec,
    catalogue: Map<string, InsuranceOptionDto>,
  ): Promise<ResolvedBenefit> {
    /**
     * REUSE BEFORE CREATE.
     *
     * The catalogue is the source of truth and it was not written by this
     * form. A company's in-patient cover may already be filed as "Inpatient and
     * daycare Details"; creating "In-patient" beside it would split the same
     * benefit across two records, and nothing could compare them afterwards.
     *
     * So every name this benefit is known by is tried — its own first, then
     * the aliases — and only a benefit the catalogue genuinely does not have is
     * created.
     */
    const existing = medicalBenefitLookupNames(spec)
      .map((name) => catalogue.get(fold(name)))
      .find((match) => match !== undefined);

    if (existing?.isUmbrella) {
      const target = (existing.children ?? []).find((child) =>
        (child.fields ?? []).some((field) => field.key !== ALTERNATIVE_VALUE_KEY),
      );
      if (!target) {
        throw new Error(
          `"${spec.name}" is a benefit group with nothing underneath it that holds a value. Add a benefit to that group on the Benefits screen, then add this plan again.`,
        );
      }

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

  /** Which benefits a variant records, core and optional together. */
  function statedBenefits(variant: VariantDraft): MedicalBenefitSpec[] {
    const all = [
      ...CORE_MEDICAL_BENEFITS,
      ...variant.extras.flatMap((extra) => {
        const spec = medicalBenefitSpec(extra);
        return spec ? [spec] : [];
      }),
    ];
    return all.filter((spec) => {
      // Ticking an optional benefit IS the statement that the variant includes
      // it; the box beside it only adds wording.
      if (variant.extras.includes(spec.name)) return true;
      const entry = variant.entries[spec.name];
      return (
        (entry?.coverage ?? '').trim() !== '' ||
        (entry?.coPayment ?? '').trim() !== '' ||
        (entry?.details ?? []).some((line) => line.trim() !== '')
      );
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const issue = validate();
    setFormError(issue);
    if (issue) return;

    setSaving(true);
    try {
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
      /**
       * CHILDREN COUNT TOO. The catalogue endpoint nests a group's members
       * inside it, so a map built from the top level alone cannot see
       * "Physiotherapy" filed under "Other key benefits" — and the form would
       * try to create a benefit the catalogue already has.
       */
      const catalogue = new Map<string, InsuranceOptionDto>();
      for (const item of page.items) {
        catalogue.set(fold(item.name), item);
        for (const child of item.children ?? []) catalogue.set(fold(child.name), child);
      }

      const definitions = new Map<string, ResolvedBenefit>();
      for (const variant of variants) {
        for (const spec of statedBenefits(variant)) {
          if (!definitions.has(spec.name)) {
            definitions.set(spec.name, await ensureBenefit(spec, catalogue));
          }
          const typed = (variant.entries[spec.name]?.coverage ?? '').trim();
          const field = definitions
            .get(spec.name)!
            .valueFields.find(
              (item) => item.key !== CO_PAYMENT_FIELD.key && item.key !== ALTERNATIVE_VALUE_KEY,
            );
          if (typed !== '' && field && coerce(typed, field.dataType) === undefined) {
            throw new Error(
              `${spec.name} takes a number, but "${typed}" is not one. Enter a figure, or change what this benefit carries on the Benefits screen.`,
            );
          }
        }
      }

      // --- the plan, once ---------------------------------------------------
      const plan = await api.post<PlanDto>('/plans', {
        companyId,
        customerType,
        name: name.trim(),
        code: derivePlanCode(name, customerType),
        isActive: true,
      });

      // --- each variant: its benefits once, its whole rate table with it ----
      for (const variant of variants) {
        const label = variantDisplayName(name, variant.geographicalCoverage);

        setProgress(`Saving ${label}…`);
        const configuration = await api.post<PlanConfigurationDto>('/plan-configurations', {
          planId: plan.id,
          geographicalCoverage: variant.geographicalCoverage,
          medicalNetworkId: variant.medicalNetworkId === '' ? null : variant.medicalNetworkId,
          currency: DEFAULT_CURRENCY,
          annualLimit: Number(variant.annualLimit),
          /**
           * The whole rate table in the same request. It used to be one variant
           * per band, each a copy of the last carrying its own duplicate of
           * every benefit; a band is now a row, so the cover is entered once.
           */
          priceBands: priced(variant).map((band) => ({
            ageFrom: Number(band.from),
            ageTo: Number(band.to),
            annualPrice: Number(band.premium),
          })),
          isActive: true,
        });

        for (const spec of statedBenefits(variant)) {
          const definition = definitions.get(spec.name)!;
          const attached = await api.post<PlanOptionDto[]>(
            `/plan-configurations/${configuration.id}/options`,
            { optionId: definition.attach.id },
          );
          const row = attached.find((item) => item.optionId === definition.valueOptionId);
          if (!row) continue;

          const entry = variant.entries[spec.name] ?? emptyEntry();
          const isExtra = variant.extras.includes(spec.name);
          const written = isExtra
            ? entry.coverage.trim() === ''
              ? BENEFIT_INCLUDED_LABEL
              : entry.coverage.trim()
            : entry.coverage.trim();

          const coverageField = row.values.find(
            (value) => value.fieldKey !== CO_PAYMENT_FIELD.key,
          );
          if (coverageField && written !== '') {
            const value = coerce(written, coverageField.dataType);
            if (value === undefined) {
              throw new Error(
                `${spec.name} takes a number, but "${written}" is not one. Enter a figure, or change what this benefit carries on the Benefits screen.`,
              );
            }
            await api.put(`/plan-options/${row.id}/values/${coverageField.optionFieldId}`, {
              value,
            });
          }

          const coPaymentField = row.values.find(
            (value) => value.fieldKey === CO_PAYMENT_FIELD.key,
          );
          if (coPaymentField && entry.coPayment.trim() !== '') {
            await api.put(`/plan-options/${row.id}/values/${coPaymentField.optionFieldId}`, {
              value: Number(entry.coPayment),
            });
          }

          const details = entry.details.map((line) => line.trim()).filter((line) => line !== '');
          if (details.length > 0) {
            await api.patch(`/plan-options/${row.id}/note`, {
              note: details.join(BENEFIT_DETAIL_SEPARATOR),
            });
          }
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.plans }),
        queryClient.invalidateQueries({ queryKey: keys.planConfigurations }),
        queryClient.invalidateQueries({ queryKey: keys.insuranceOptions }),
      ]);

      notify(
        `${plan.name} was added with ${variants.length} ${
          variants.length === 1 ? 'variant' : 'variants'
        }.`,
      );
      onCreated(plan.name);

      setName('');
      setVariants([newVariant(CORE_MEDICAL_BENEFITS)]);
    } catch (error) {
      // The form raises its own plain Errors for problems it can explain
      // precisely; anything from the API is translated as elsewhere.
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

      <section className="space-y-4">
        <SectionTitle>Plan</SectionTitle>
        <p className="text-content-subtle -mt-2 text-sm">
          The product itself. Everything that can differ between the ways it is sold belongs to a
          variant below.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Insurance company">
            {(props) => (
              <Input
                {...props}
                value={companyName ?? ''}
                readOnly
                disabled
                className="opacity-70"
              />
            )}
          </Field>

          <Field label="Plan name" required>
            {(props) => (
              <Input
                {...props}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Gold+"
              />
            )}
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Variants</SectionTitle>

        {variants.map((variant, index) => (
          <VariantEditor
            key={variant.key}
            planName={name}
            position={index + 1}
            variant={variant}
            networks={networks.data ?? []}
            currency={DEFAULT_CURRENCY}
            existingKinds={existingKinds}
            onChange={(patch) => patchVariant(variant.key, patch)}
            {...(variants.length > 1
              ? {
                  onRemove: () =>
                    setVariants((current) => current.filter((item) => item.key !== variant.key)),
                }
              : {})}
          />
        ))}

        <Button type="button" variant="secondary" onClick={addVariant}>
          <IconAdd className="size-4" />
          Add variant
        </Button>
      </section>

      <div className="flex items-center justify-end gap-3">
        {progress ? <span className="text-content-subtle text-sm">{progress}</span> : null}
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save plan'}
        </Button>
      </div>
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
