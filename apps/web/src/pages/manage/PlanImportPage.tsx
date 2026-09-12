import {
  ALTERNATIVE_VALUE_KEY,
  CORE_MEDICAL_BENEFITS,
  CO_PAYMENT_FIELD,
  CUSTOMER_TYPES,
  UNSPECIFIED_OPTION_LABEL,
  formatMoney,
  optionLabel,
  planImportStageLabel,
  planTierLabel,
  type CompanyDto,
  type MedicalBenefitSpec,
  type MedicalNetworkDto,
  type PlanImportJobDto,
} from '@aggregator/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CompanyLogo,
  Field,
  IconBuilding,
  IconCheck,
  IconLayers,
  IconShield,
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
import type { BenefitEntry, VariantDraft } from '@/features/company-setup/variant-draft';
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
import { cn } from '@/lib/cn';

const fold = (name: string) => name.trim().toLowerCase();

/**
 * ONE IMPORT, START TO FINISH.
 *
 * While the document is being read this is a progress page: the stage, the
 * percentage, and the plans ticked off as the model finishes each. Once the
 * answer is in, it is the review: one tab per plan, the open one shown at a
 * glance and then in full — the same editor the add-plan form uses — with
 * each unstated limit flagged for confirmation. Each plan has its own Publish,
 * and the header publishes every plan still pending; both write exactly as
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

  return <Review job={job.data} company={company.data} crumbs={crumbs} />;
}

/** Seconds since the job started, ticking on the screen's own clock. */
function useElapsedSeconds(since: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.round((now - new Date(since).getTime()) / 1000));
}

function Progress({ job }: { job: PlanImportJobDto }) {
  const elapsed = useElapsedSeconds(job.createdAt);
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-content-subtle flex items-center gap-2 text-xs font-semibold tracking-[0.08em] uppercase">
              {/* A pulse that never stops: the page is alive even when the number is not moving. */}
              <span aria-hidden className="relative flex size-2.5">
                <span className="bg-brand absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                <span className="bg-brand relative inline-flex size-2.5 rounded-full" />
              </span>
              {planImportStageLabel(job.status)}
            </p>
            <p className="text-content mt-1 text-4xl font-semibold tabular-nums">
              <span aria-live="polite">{job.percent}%</span>
            </p>
          </div>
          <div className="text-content-subtle text-right text-sm tabular-nums">
            {job.planNames.length > 0 ? (
              <p>
                {job.plansCompleted} of {job.planNames.length} plans read
              </p>
            ) : null}
            <p>Working for {clock}</p>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={job.percent}
          aria-label="Import progress"
          className="bg-surface-muted relative h-2.5 w-full overflow-hidden rounded-full"
        >
          <div
            className="bg-brand h-full transition-[width] duration-1000 ease-out"
            style={{ width: `${job.percent}%` }}
          />
          {/* The sheen crosses the whole track, so it is seen even while the fill is short. */}
          <div
            aria-hidden
            className="animate-import-sheen absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
          />
        </div>

        <p className="text-content-subtle text-sm">
          The model reads the whole document and writes each plan out in full. A plan takes about
          half a minute; the bar moves as its text arrives.
        </p>

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
                    {done ? (
                      <IconCheck className="size-4" />
                    ) : reading ? (
                      <span className="bg-brand inline-block size-2 animate-pulse rounded-full" />
                    ) : (
                      '·'
                    )}
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
  company,
  crumbs,
}: {
  job: PlanImportJobDto;
  company: CompanyDto | undefined;
  crumbs: { label: string; to?: string }[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const networks = useMedicalNetworks();
  const catalogue = useInsuranceOptions({ isActive: true });
  const result = job.result!;
  const section = optionLabel(CUSTOMER_TYPES, job.customerType);
  const companyName = company?.name ?? 'the company';

  const [drafts, setDrafts] = useState<ImportPlanDraft[] | null>(null);
  /** The plan being written right now, if any. One at a time, always. */
  const [publishingKey, setPublishingKey] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<string[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // The drafts are made ONCE, when the networks are known: after that they are
  // the employee's, and a refetch must not overwrite what they typed.
  useEffect(() => {
    if (drafts === null && networks.data) {
      const made = toPlanDrafts(result, networks.data);
      setDrafts(made);
      setActiveKey(made[0]?.key ?? null);
    }
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

  const all = drafts ?? [];
  const pending = all.filter((draft) => !draft.skipped && !published.includes(draft.key));
  const allReady = pending.length > 0 && pending.every(draftReady);
  const publishing = publishingKey !== null;

  /**
   * Write the named plans, one after another, exactly as typed plans are
   * written. "Publish" on a card sends one key; "Publish all" sends every
   * plan still pending. A plan that fails stops the run and stays pending;
   * the ones before it are already in.
   */
  async function publishPlans(planKeys: string[]) {
    if (!drafts) return;
    setError(null);
    /** Networks created during this run, by folded name, so two plans on one new network share it. */
    const createdNetworks = new Map<string, string>();
    let written = 0;

    try {
      for (const key of planKeys) {
        const draft = drafts.find((item) => item.key === key);
        if (!draft || draft.skipped || published.includes(key)) continue;
        setPublishingKey(key);

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

        await savePlanDraft({ ...input, medicalNetworkId: networkId }, setProgress);
        setPublished((current) => [...current, key]);
        written += 1;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.plans }),
        queryClient.invalidateQueries({ queryKey: keys.planConfigurations }),
        queryClient.invalidateQueries({ queryKey: keys.insuranceOptions }),
        queryClient.invalidateQueries({ queryKey: keys.medicalNetworks }),
      ]);

      const nowPublished = new Set([...published, ...planKeys]);
      const everyPlanIn = all.every((draft) => draft.skipped || nowPublished.has(draft.key));
      notify(
        `${written} ${written === 1 ? 'plan was' : 'plans were'} added to ${companyName}'s ${section} plans.`,
      );
      // Nothing left to review: back to the company, where the plans now are.
      if (everyPlanIn) navigate(ROUTES.companies.detail(job.companyId));
    } catch (cause) {
      setError(
        cause instanceof ApiError || !(cause instanceof Error)
          ? describeError(cause, 'the plan')
          : cause.message,
      );
    } finally {
      setPublishingKey(null);
      setProgress(null);
    }
  }

  const warningsTotal = all.reduce(
    (sum, draft) => sum + (draft.skipped ? 0 : draftWarnings(draft).length),
    0,
  );
  const active = all.find((draft) => draft.key === activeKey) ?? all[0];

  return (
    <>
      <PageHeader
        title="Review the imported plans"
        description={`${result.plans.length} ${result.plans.length === 1 ? 'plan' : 'plans'} read from ${job.fileName}. They will be added to ${companyName}'s ${section} plans.`}
        breadcrumbs={crumbs}
        actions={
          <div className="flex items-center gap-3">
            {progress ? <span className="text-content-subtle text-sm">{progress}</span> : null}
            <Button
              onClick={() => void publishPlans(pending.map((draft) => draft.key))}
              disabled={!allReady || publishing}
            >
              {publishing ? 'Publishing…' : `Publish all (${pending.length})`}
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
          annual limit. Confirm each one on its plan before publishing.
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
            ? ` ${published.length} ${published.length === 1 ? 'plan was' : 'plans were'} already added; the rest are still here to publish.`
            : ''}
        </Callout>
      ) : null}

      {/* ONE PLAN AT A TIME. Each plan is a tab; the open one is the whole card
          below. Publishing happens per plan, or all at once from the header. */}
      <div>
        <div role="tablist" aria-label="Imported plans" className="flex flex-wrap gap-1 px-1">
          {all.map((draft, index) => {
            const selected = draft.key === active?.key;
            const done = published.includes(draft.key);
            return (
              <button
                key={draft.key}
                type="button"
                role="tab"
                id={`tab-${draft.key}`}
                aria-selected={selected}
                aria-controls={`panel-${draft.key}`}
                onClick={() => setActiveKey(draft.key)}
                className={cn(
                  'flex min-w-44 items-center gap-2.5 rounded-t-(--radius-card) border border-b-0 px-4 py-2.5 text-left text-sm transition-colors',
                  selected
                    ? 'border-border-subtle bg-surface text-content font-semibold shadow-sm'
                    : 'border-transparent bg-surface-muted/60 text-content-subtle hover:bg-surface-muted',
                  draft.skipped && !selected && 'line-through opacity-70',
                )}
              >
                <IconLayers className={cn('size-4', selected ? 'text-brand' : '')} />
                <span className="truncate">{draft.name || `Plan ${index + 1}`}</span>
                {done ? (
                  <span className="text-success ml-auto flex items-center">
                    <IconCheck className="size-4" />
                    <span className="sr-only">Published</span>
                  </span>
                ) : publishingKey === draft.key ? (
                  <Spinner className="ml-auto" />
                ) : null}
              </button>
            );
          })}
        </div>

        {active ? (
          <div
            role="tabpanel"
            id={`panel-${active.key}`}
            aria-labelledby={`tab-${active.key}`}
            className="border-border-subtle bg-surface rounded-(--radius-card) rounded-tl-none border shadow-sm"
          >
            <PlanPanel
              key={active.key}
              draft={active}
              position={all.indexOf(active) + 1}
              total={all.length}
              company={company}
              currency={
                active.variants[0]?.currency || result.document.currency || DEFAULT_CURRENCY
              }
              networks={networks.data ?? []}
              existingKinds={existingKinds}
              done={published.includes(active.key)}
              publishingThis={publishingKey === active.key}
              busy={publishing}
              onPublish={() => void publishPlans([active.key])}
              onChange={(change) => patch(active.key, change)}
              onVariantChange={(variantKey, change) => patchVariant(active.key, variantKey, change)}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

/** A small turning ring, for a plan that is being written. */
function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  );
}

/** What a core area reads as on the summary: the figure, and the member's share beside it. */
function summariseCoreArea(
  spec: MedicalBenefitSpec,
  entry: BenefitEntry | undefined,
  currency: string,
): string {
  const raw = (entry?.coverage ?? '').trim();
  if (raw === '') return spec.valueKind === 'PERCENTAGE' ? 'Not stated' : 'Annual limit';
  const figure = Number(raw.replace(/,/g, ''));
  if (figure === 0) return 'Not covered';
  const base =
    spec.valueKind === 'PERCENTAGE'
      ? `${raw}%`
      : Number.isFinite(figure)
        ? formatMoney(figure, currency)
        : raw;
  const share = (entry?.coPayment ?? '').trim();
  return share !== '' ? `${base} · ${share}% co-pay` : base;
}

/** The co-payment tile: the plan-wide share if stated, else the areas that carry one. */
function summariseCoPayment(draft: ImportPlanDraft): string {
  const variant = draft.variants[0];
  if (!variant) return 'None stated';
  const planWide = (variant.coPayment ?? '').trim();
  if (planWide !== '') return `${planWide}%`;
  const areas = CORE_MEDICAL_BENEFITS.flatMap((spec) => {
    const share = (variant.entries[spec.name]?.coPayment ?? '').trim();
    return share !== '' ? [`${spec.name} ${share}%`] : [];
  });
  return areas.length > 0 ? areas.join(', ') : 'None stated';
}

/** The document's own summary of the plan, as bullet points. */
function keyFeatures(draft: ImportPlanDraft): string[] {
  const sentences = draft.description
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, 4);
  return [...sentences, ...draft.waitingPeriods.map((line) => `Waiting period: ${line}`)];
}

function PlanPanel({
  draft,
  position,
  total,
  company,
  currency,
  networks,
  existingKinds,
  done,
  publishingThis,
  busy,
  onPublish,
  onChange,
  onVariantChange,
}: {
  draft: ImportPlanDraft;
  position: number;
  total: number;
  company: CompanyDto | undefined;
  currency: string;
  networks: MedicalNetworkDto[];
  existingKinds: Map<string, ExistingKind>;
  done: boolean;
  /** This plan is the one being written right now. */
  publishingThis: boolean;
  /** Some plan is being written, so nothing else may start. */
  busy: boolean;
  onPublish: () => void;
  onChange: (change: Partial<ImportPlanDraft>) => void;
  onVariantChange: (variantKey: string, change: Partial<VariantDraft>) => void;
}) {
  const warnings = draftWarnings(draft);
  const ready = draftReady(draft);
  const variant = draft.variants[0];
  const annualLimit = Number((variant?.annualLimit ?? '').replace(/,/g, ''));
  const hasLimit = (variant?.annualLimit ?? '').trim() !== '' && Number.isFinite(annualLimit);
  const networkName =
    draft.medicalNetworkId === CREATE_NETWORK
      ? draft.networkName
      : (networks.find((network) => network.id === draft.medicalNetworkId)?.name ??
        (draft.networkName || UNSPECIFIED_OPTION_LABEL));
  const features = keyFeatures(draft);

  return (
    <div className="space-y-6 p-5">
      {/* ---- the plan at a glance, as on the mock ---------------------- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="bg-brand-soft text-brand flex size-11 shrink-0 items-center justify-center rounded-(--radius-control)">
            <IconLayers className="size-6" />
          </span>
          <div>
            <h2 className="text-content text-xl font-semibold">
              {draft.name || `Plan ${position}`}
            </h2>
            <p className="text-content-subtle mt-0.5 text-sm">
              Plan {position} of {total}
              {draft.tierCode ? ` · Network tier ${draft.tierCode}` : ''}
            </p>
            {done ? (
              <Badge tone="success" className="mt-2">
                <IconCheck className="size-3.5" /> Published
              </Badge>
            ) : draft.skipped ? (
              <Badge tone="neutral" className="mt-2">
                Skipped
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {company ? <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="md" /> : null}
          {done ? (
            <span className="text-success flex items-center gap-1.5 text-sm font-medium">
              <IconCheck className="size-4" /> Published
            </span>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onChange({ skipped: !draft.skipped })}
              >
                {draft.skipped ? 'Include' : 'Skip'}
              </Button>
              {!draft.skipped ? (
                <Button size="sm" onClick={onPublish} disabled={busy || !ready}>
                  {publishingThis ? (
                    <>
                      <Spinner /> Publishing…
                    </>
                  ) : (
                    'Publish'
                  )}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label="Annual limit"
          value={hasLimit ? formatMoney(annualLimit, currency) : 'Not stated'}
        />
        <Tile label="Co-payment" value={summariseCoPayment(draft)} />
        <Tile label="Type" value={(hasLimit ? planTierLabel(annualLimit) : null) ?? 'Not stated'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border-border-subtle rounded-(--radius-card) border p-4">
          <h3 className="text-content text-sm font-semibold">Core benefits</h3>
          <ul className="mt-3 space-y-2.5">
            {CORE_MEDICAL_BENEFITS.map((spec) => (
              <li key={spec.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-content flex items-center gap-2.5">
                  <span aria-hidden className="text-base leading-none">
                    {spec.emoji}
                  </span>
                  {spec.name}
                </span>
                <span className="text-content font-semibold tabular-nums">
                  {summariseCoreArea(spec, variant?.entries[spec.name], currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-4">
          <section className="bg-surface-muted/50 rounded-(--radius-card) p-4">
            <h3 className="text-content flex items-center gap-2 text-sm font-semibold">
              <IconShield className="text-brand size-4" /> Key features
            </h3>
            {features.length > 0 ? (
              <ul className="text-content-subtle mt-2 list-disc space-y-1 pl-5 text-sm">
                {features.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-content-subtle mt-2 text-sm">
                The document gives no summary of this plan.
              </p>
            )}
          </section>
          <section className="bg-surface-muted/50 rounded-(--radius-card) p-4">
            <h3 className="text-content flex items-center gap-2 text-sm font-semibold">
              <IconBuilding className="text-brand size-4" /> Medical network
            </h3>
            <p className="text-content-subtle mt-1 text-sm">{networkName}</p>
          </section>
        </div>
      </div>

      {/* ---- the details, editable, exactly as the add-plan form ------- */}
      {done || draft.skipped ? null : (
        <div className="border-border-subtle space-y-6 border-t pt-6">
          <h3 className="text-content-subtle text-xs font-semibold tracking-[0.08em] uppercase">
            Details
          </h3>

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

          {draft.variants.map((item, index) => (
            <VariantEditor
              key={item.key}
              planName={draft.name}
              position={index + 1}
              variant={item}
              currency={item.currency || currency}
              existingKinds={existingKinds}
              onChange={(change) => onVariantChange(item.key, change)}
              {...(draft.variants.length > 1
                ? {
                    onRemove: () =>
                      onChange({
                        variants: draft.variants.filter((other) => other.key !== item.key),
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
        </div>
      )}
    </div>
  );
}

/** One figure at a glance. */
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-muted/50 rounded-(--radius-card) p-4">
      <p className="text-content-subtle text-xs font-medium">{label}</p>
      <p className="text-content mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
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
