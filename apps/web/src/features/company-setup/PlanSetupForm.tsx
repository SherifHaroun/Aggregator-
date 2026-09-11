import { useMemo, useState } from 'react';
import {
  ALTERNATIVE_VALUE_KEY,
  CO_PAYMENT_FIELD,
  CORE_MEDICAL_BENEFITS,
  UNSPECIFIED_OPTION_LABEL,
  type CustomerTypeId,
} from '@aggregator/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Callout, Field, IconAdd, Input, Select, useToast } from '@/components/ui';
import { describeError } from '@/components/ui/DataState';
import {
  keys,
  useInsuranceOptions,
  useMedicalNetworks,
} from '@/features/insurance-data/insurance-data.api';
import { ApiError } from '@/lib/api-client';
import { DEFAULT_CURRENCY, savePlanDraft, validatePlanDraft } from './save-plan';
import { VariantEditor, type ExistingKind } from './VariantEditor';
import { newVariant, type VariantDraft } from './variant-draft';

/**
 * ONE PLAN, ANY NUMBER OF VARIANTS.
 *
 * A plan is the product: its name, and the NETWORK it is sold on, which every
 * variant shares. Everything that can differ between the ways it is sold —
 * what it covers, at what ceiling, with which benefits and at what premium per
 * age — belongs to a VARIANT. "Gold+ Local" and "Gold+ International" are
 * therefore one Gold+ plan with two variants, never two plans with the scope
 * written into their names.
 *
 * The form only DRAFTS. Writing the draft — settling benefits against the
 * catalogue, the plan once, each variant with its rate table — is
 * `savePlanDraft`, shared with the document import so a typed plan and an
 * imported one land in the database the same way.
 */

const fold = (name: string) => name.trim().toLowerCase();

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
  const networks = useMedicalNetworks();
  const catalogueQuery = useInsuranceOptions({ isActive: true });

  const [name, setName] = useState('');
  /** The shared network every variant of this plan is sold on. '' = not stated. */
  const [medicalNetworkId, setMedicalNetworkId] = useState('');
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = { companyId, customerType, name, medicalNetworkId, variants };
    const issue = validatePlanDraft(input);
    setFormError(issue);
    if (issue) return;

    setSaving(true);
    try {
      const plan = await savePlanDraft(input, setProgress);

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
      setMedicalNetworkId('');
      setVariants([newVariant(CORE_MEDICAL_BENEFITS)]);
    } catch (error) {
      // The save raises its own plain Errors for problems it can explain
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
          The product itself, and the network it is sold on. Everything that can differ between the
          ways it is sold belongs to a variant below.
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

          {/* Chosen from the shared list, never typed. Every variant of the
              plan inherits it; the customer sees the name and can download the
              provider list, nothing about tiers. */}
          <Field
            label="Medical network"
            hint={
              (networks.data?.length ?? 0) === 0
                ? 'No networks yet. Add them on the Medical networks screen.'
                : 'Every variant of this plan is sold on it.'
            }
          >
            {(props) => (
              <Select
                {...props}
                value={medicalNetworkId}
                disabled={(networks.data?.length ?? 0) === 0}
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
