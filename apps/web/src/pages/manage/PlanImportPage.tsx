import {
  ALTERNATIVE_VALUE_KEY,
  CO_PAYMENT_FIELD,
  CUSTOMER_TYPES,
  UNSPECIFIED_OPTION_LABEL,
  optionLabel,
  planImportStageLabel,
  type MedicalNetworkDto,
  type PlanImportJobDto,
} from '@aggregator/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Field,
  IconCheck,
  IconLayers,
  IconTrash,
  Input,
  PageHeader,
  Select,
  Textarea,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  DEFAULT_CURRENCY,
  savePlanDraft,
  validatePlanDraft,
} from '@/features/company-setup/save-plan';
import { VariantEditor, type ExistingKind } from '@/features/company-setup/VariantEditor';
import type { VariantDraft } from '@/features/company-setup/variant-draft';
import {
  keys,
  useCompany,
  useInsuranceOptions,
  useMedicalNetworks,
} from '@/features/insurance-data/insurance-data.api';
import {
  CREATE_NETWORK,
  descriptionForPublish,
  draftReady,
  draftWarnings,
  reviewWarningKey,
  toPlanDrafts,
  type ImportPlanDraft,
} from '@/features/plan-import/import-draft';
import { usePlanImport } from '@/features/plan-import/plan-import.api';
import { ApiError, api } from '@/lib/api-client';

const fold = (name: string) => name.trim().toLowerCase();

/**
 * ONE IMPORT, START TO FINISH.
 *
 * While the document is being read this is a progress page: the stage, the
 * percentage, and the plans ticked off as the model finishes each. Once the
 * answer is in, it is the review: every plan as a card the employee can edit
 * — the same editor the add-plan form uses — with each unstated limit flagged
 * for confirmation, and one Publish button that writes them all, exactly as
 * typed plans are written.
 */
export function PlanImportPage() {
  const { companyId, jobId } = useParams();
  const company = useCompany(companyId);
  const job = usePlanImport(jobId);

  const section = job.data ? optionLabel(CUSTOMER_TYPES, job.data.customerType) : '';
  const crumbs = [
    { label: 'Companies', to: ROUTES.companies.list },
    {
      label: company.data?.name ?? 'Company',
      to: companyId ? ROUTES.companies.detail(companyId) : undefined,
    },
    { label: 'Import plans' },
  ];

  if (job.isLoading || !job.data) {
    return (
      <>
        <PageHeader title="Import plans" breadcrumbs={crumbs} />
        {job.error ? (
          <Callout tone="danger" title="This import could not be found">
            {describeError(job.error, 'the import')}. It may have expired — upload the document
            again from the company page.
          </Callout>
        ) : (
          <p className="text-content-subtle text-sm">Loading…</p>
        )}
      </>
    );
  }

  if (job.data.status === 'FAILED') {
    return (
      <>
        <PageHeader
          title="Import plans"
          description={`${job.data.fileName} · ${section} section`}
          breadcrumbs={crumbs}
        />
        <Callout tone="danger" title="The document could not be read">
          <p>{job.data.error}</p>
          <p className="mt-2">
            <Link
              className="text-brand-strong font-medium"
              to={ROUTES.companies.detail(job.data.companyId)}
            >
              Back to {company.data?.name ?? 'the company'}
            </Link>
          </p>
        </Callout>
      </>
    );
  }

  if (job.data.status !== 'DONE' || !job.data.result) {
    return (
      <>
        <PageHeader
          title="Reading the document"
          description={`${job.data.fileName} · ${section} section`}
          breadcrumbs={crumbs}
        />
        <Progress job={job.data} />
      </>
    );
  }

  return (
    <Review job={job.data} companyName={company.data?.name ?? 'the company'} crumbs={crumbs} />
  );
}

function Progress({ job }: { job: PlanImportJobDto }) {
  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-content-subtle text-xs font-semibold tracking-[0.08em] uppercase">
              {planImportStageLabel(job.status)}
            </p>
            <p className="text-content mt-1 text-4xl font-semibold tabular-nums">
              <span aria-live="polite">{job.percent}%</span>
            </p>
          </div>
          {job.planNames.length > 0 ? (
            <p className="text-content-subtle text-sm">
              {job.plansCompleted} of {job.planNames.length} plans read
            </p>
          ) : null}
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={job.percent}
          aria-label="Import progress"
          className="bg-surface-muted h-2.5 w-full overflow-hidden rounded-full"
        >
          <div
            className="bg-brand h-full transition-[width]"
            style={{ width: `${job.percent}%` }}
          />
        </div>

        {job.planNames.length > 0 ? (
          <ul className="space-y-1.5">
            {job.planNames.map((name, index) => {
              const done = index < job.plansCompleted;
              const reading = index === job.plansCompleted;
              return (
                <li key={name} className="text-content flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className={
                      done
                        ? 'text-success flex size-5 items-center justify-center'
                        : 'text-content-subtle flex size-5 items-center justify-center'
                    }
                  >
                    {done ? <IconCheck className="size-4" /> : reading ? '…' : '·'}
                  </span>
                  <span className={done ? '' : reading ? 'font-medium' : 'text-content-subtle'}>
                    {name}
                    {reading ? ' — reading' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-content-subtle text-sm">
            The plan names appear here as soon as the document has been opened.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function Review({
  job,
  companyName,
  crumbs,
}: {
  job: PlanImportJobDto;
  companyName: string;
  crumbs: { label: string; to?: string }[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const networks = useMedicalNetworks();
  const catalogue = useInsuranceOptions({ isActive: true });
  const result = job.result!;
  const section = optionLabel(CUSTOMER_TYPES, job.customerType);

  const [drafts, setDrafts] = useState<ImportPlanDraft[] | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<string[]>([]);

  // The drafts are made ONCE, when the networks are known: after that they are
  // the employee's, and a refetch must not overwrite what they typed.
  useEffect(() => {
    if (drafts === null && networks.data) setDrafts(toPlanDrafts(result, networks.data));
  }, [drafts, networks.data, result]);

  const existingKinds = useMemo(() => {
    const byName = new Map<string, ExistingKind>();
    for (const option of catalogue.data ?? []) {
      for (const item of [option, ...(option.children ?? [])]) {
        const field = (item.fields ?? []).find(
          (candidate) =>
            candidate.key !== CO_PAYMENT_FIELD.key && candidate.key !== ALTERNATIVE_VALUE_KEY,
        );
        if (field) byName.set(fold(item.name), { dataType: field.dataType, unit: field.unit });
      }
    }
    return byName;
  }, [catalogue.data]);

  function patch(key: string, change: Partial<ImportPlanDraft>) {
    setDrafts((current) =>
      (current ?? []).map((draft) => (draft.key === key ? { ...draft, ...change } : draft)),
    );
  }

  function patchVariant(planKey: string, variantKey: string, change: Partial<VariantDraft>) {
    setDrafts((current) =>
      (current ?? []).map((draft) =>
        draft.key === planKey
          ? {
              ...draft,
              variants: draft.variants.map((variant) =>
                variant.key === variantKey ? { ...variant, ...change } : variant,
              ),
            }
          : draft,
      ),
    );
  }

  const pending = (drafts ?? []).filter(
    (draft) => !draft.skipped && !published.includes(draft.key),
  );
  const allReady = pending.length > 0 && pending.every(draftReady);

  async function publish() {
    if (!drafts) return;
    setPublishing(true);
    setError(null);
    /** Networks created during this publish, by folded name, so two plans on one new network share it. */
    const createdNetworks = new Map<string, string>();

    try {
      for (const draft of pending) {
        const input = {
          companyId: job.companyId,
          customerType: job.customerType,
          name: draft.name,
          description: descriptionForPublish(draft),
          medicalNetworkId: '',
          variants: draft.variants,
        };
        const issue = validatePlanDraft(input);
        if (issue) throw new Error(`${draft.name || 'A plan'}: ${issue}`);

        let networkId = draft.medicalNetworkId;
        if (networkId === CREATE_NETWORK) {
          const wanted = fold(draft.networkName);
          networkId =
            createdNetworks.get(wanted) ??
            (networks.data ?? []).find((network) => fold(network.name) === wanted)?.id ??
            '';
          if (networkId === '') {
            setProgress(`Adding the network "${draft.networkName}"…`);
            const created = await api.post<MedicalNetworkDto>('/medical-networks', {
              name: draft.networkName,
            });
            networkId = created.id;
            createdNetworks.set(wanted, created.id);
          }
        }

        await savePlanDraft({ ...input, medicalNetworkId: networkId }, (message) =>
          setProgress(`${draft.name}: ${message}`),
        );
        setPublished((current) => [...current, draft.key]);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.plans }),
        queryClient.invalidateQueries({ queryKey: keys.planConfigurations }),
        queryClient.invalidateQueries({ queryKey: keys.insuranceOptions }),
        queryClient.invalidateQueries({ queryKey: keys.medicalNetworks }),
      ]);
      const count = pending.length;
      notify(
        `${count} ${count === 1 ? 'plan was' : 'plans were'} added to ${companyName}'s ${section} plans.`,
      );
      navigate(ROUTES.companies.detail(job.companyId));
    } catch (cause) {
      setError(
        cause instanceof ApiError || !(cause instanceof Error)
          ? describeError(cause, 'the plan')
          : cause.message,
      );
    } finally {
      setPublishing(false);
      setProgress(null);
    }
  }

  const total = (drafts ?? []).length;
  const warningsTotal = (drafts ?? []).reduce(
    (sum, draft) => sum + (draft.skipped ? 0 : draftWarnings(draft).length),
    0,
  );

  return (
    <>
      <PageHeader
        title="Review the imported plans"
        description={`${result.plans.length} ${result.plans.length === 1 ? 'plan' : 'plans'} read from ${job.fileName}. They will be added to ${companyName}'s ${section} plans.`}
        breadcrumbs={crumbs}
        actions={
          <div className="flex items-center gap-3">
            {progress ? <span className="text-content-subtle text-sm">{progress}</span> : null}
            <Button onClick={() => void publish()} disabled={!allReady || publishing}>
              {publishing
                ? 'Publishing…'
                : `Publish ${pending.length} ${pending.length === 1 ? 'plan' : 'plans'}`}
            </Button>
          </div>
        }
      />

      {!result.document.matchesCompany ? (
        <Callout tone="warning" title="Check the insurer">
          The document names {result.document.insurerNameInDocument || 'a different insurer'}, but
          it is being imported into {companyName}.
        </Callout>
      ) : null}

      {warningsTotal > 0 ? (
        <Callout
          tone="warning"
          title={`${warningsTotal} ${warningsTotal === 1 ? 'figure needs' : 'figures need'} confirming`}
        >
          Where the document names an area but states no limit, the comparison will use the plan's
          annual limit. Confirm each one below before publishing.
        </Callout>
      ) : null}

      {result.warnings.length > 0 || result.unplaced.length > 0 ? (
        <Callout tone="info" title="What the reader noticed">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {result.warnings.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {result.unplaced.map((line) => (
              <li key={line}>Not placed on any plan: {line}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {error ? (
        <Callout tone="danger" title="Could not publish">
          {error}
          {published.length > 0
            ? ` ${published.length} ${published.length === 1 ? 'plan was' : 'plans were'} already added; publishing again continues with the rest.`
            : ''}
        </Callout>
      ) : null}

      <div className="space-y-6">
        {(drafts ?? []).map((draft, index) => (
          <PlanCard
            key={draft.key}
            draft={draft}
            position={index + 1}
            total={total}
            currency={draft.variants[0]?.currency || result.document.currency || DEFAULT_CURRENCY}
            networks={networks.data ?? []}
            existingKinds={existingKinds}
            done={published.includes(draft.key)}
            busy={publishing}
            onChange={(change) => patch(draft.key, change)}
            onVariantChange={(variantKey, change) => patchVariant(draft.key, variantKey, change)}
          />
        ))}
      </div>
    </>
  );
}

function PlanCard({
  draft,
  position,
  total,
  currency,
  networks,
  existingKinds,
  done,
  busy,
  onChange,
  onVariantChange,
}: {
  draft: ImportPlanDraft;
  position: number;
  total: number;
  currency: string;
  networks: MedicalNetworkDto[];
  existingKinds: Map<string, ExistingKind>;
  done: boolean;
  busy: boolean;
  onChange: (change: Partial<ImportPlanDraft>) => void;
  onVariantChange: (variantKey: string, change: Partial<VariantDraft>) => void;
}) {
  const warnings = draftWarnings(draft);
  const locked = done || draft.skipped;

  return (
    <Card>
      <CardHeader
        title={draft.name || `Plan ${position}`}
        icon={<IconLayers className="size-5" />}
        description={
          done
            ? 'Added.'
            : draft.skipped
              ? 'Skipped — it will not be added.'
              : `Plan ${position} of ${total}${draft.tierCode ? ` · network tier ${draft.tierCode} (for reference, not saved)` : ''}`
        }
        action={
          done ? (
            <span className="text-success flex items-center gap-1.5 text-sm font-medium">
              <IconCheck className="size-4" /> Published
            </span>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onChange({ skipped: !draft.skipped })}
            >
              {draft.skipped ? (
                'Include this plan'
              ) : (
                <>
                  <IconTrash className="size-4" />
                  Skip this plan
                </>
              )}
            </Button>
          )
        }
      />
      {locked ? null : (
        <CardBody className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan name" required>
              {(props) => (
                <Input
                  {...props}
                  value={draft.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                />
              )}
            </Field>

            <Field
              label="Medical network"
              hint={
                draft.medicalNetworkId === CREATE_NETWORK
                  ? `"${draft.networkName}" is not on the shared list yet. It will be added when you publish.`
                  : 'Every variant of this plan is sold on it.'
              }
            >
              {(props) => (
                <Select
                  {...props}
                  value={draft.medicalNetworkId}
                  onChange={(event) => onChange({ medicalNetworkId: event.target.value })}
                >
                  <option value="">{UNSPECIFIED_OPTION_LABEL}</option>
                  {draft.networkName !== '' &&
                  !networks.some((network) => fold(network.name) === fold(draft.networkName)) ? (
                    <option value={CREATE_NETWORK}>Add “{draft.networkName}” to the list</option>
                  ) : null}
                  {networks.map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="sm:col-span-2">
              <Field label="Description" hint="The document's own summary of the plan.">
                {(props) => (
                  <Textarea
                    {...props}
                    rows={3}
                    value={draft.description}
                    onChange={(event) => onChange({ description: event.target.value })}
                  />
                )}
              </Field>
            </div>
          </div>

          {warnings.length > 0 ? (
            <section
              aria-label={`${draft.name || `Plan ${position}`} confirmations`}
              className="border-warning/40 bg-warning-soft/40 space-y-3 rounded-(--radius-card) border p-4"
            >
              <p className="text-content text-sm font-semibold">Confirm before publishing</p>
              <ul className="space-y-2">
                {warnings.map((warning) => {
                  const key = reviewWarningKey(warning);
                  const checked = draft.confirmed.includes(key);
                  return (
                    <li key={key} className="flex items-start gap-3">
                      <input
                        id={`${draft.key}-${key}`}
                        type="checkbox"
                        className="mt-1 size-4"
                        checked={checked}
                        onChange={(event) =>
                          onChange({
                            confirmed: event.target.checked
                              ? [...draft.confirmed, key]
                              : draft.confirmed.filter((item) => item !== key),
                          })
                        }
                      />
                      <label htmlFor={`${draft.key}-${key}`} className="text-content text-sm">
                        <span className="font-medium">{warning.benefit}.</span> {warning.message}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {draft.variants.map((variant, index) => (
            <VariantEditor
              key={variant.key}
              planName={draft.name}
              position={index + 1}
              variant={variant}
              currency={variant.currency || currency}
              existingKinds={existingKinds}
              onChange={(change) => onVariantChange(variant.key, change)}
              {...(draft.variants.length > 1
                ? {
                    onRemove: () =>
                      onChange({
                        variants: draft.variants.filter((item) => item.key !== variant.key),
                      }),
                  }
                : {})}
            />
          ))}

          <div className="grid gap-4 sm:grid-cols-3">
            <Lines
              label="Waiting periods"
              hint="Saved into the plan description."
              value={draft.waitingPeriods}
              onChange={(waitingPeriods) => onChange({ waitingPeriods })}
            />
            <Lines
              label="Conditions"
              hint="Group size, age limits, discounts."
              value={draft.conditions}
              onChange={(conditions) => onChange({ conditions })}
            />
            <Lines
              label="Exclusions"
              hint="What the document says is not covered."
              value={draft.exclusions}
              onChange={(exclusions) => onChange({ exclusions })}
            />
          </div>
        </CardBody>
      )}
    </Card>
  );
}

/** A list of lines, edited as one text with a line each. */
function Lines({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string[];
  onChange: (lines: string[]) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      {(props) => (
        <Textarea
          {...props}
          rows={4}
          value={value.join('\n')}
          onChange={(event) => onChange(event.target.value.split('\n'))}
        />
      )}
    </Field>
  );
}
