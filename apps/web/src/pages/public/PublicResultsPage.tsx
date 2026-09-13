import {
  formatNumber,
  presentAnnualLimit,
  presentPremium,
  topPlansByTier,
  type ComparisonPlanResult,
  type PlanTierId,
} from '@aggregator/shared';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, ButtonLink, EmptyState, IconChevronRight, describeError } from '@/components/ui';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { ROUTES } from '@/config/routes';
import { useCustomerSession } from '@/features/auth/auth.api';
import { loginUrl } from '@/features/auth/guards';
import { parseComparisonRequest } from '@/features/comparison';
import { useComparison } from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';

/**
 * THE CUSTOMER'S RESULTS: the best three in each tier.
 *
 * The same engine, the same ranking and the same criteria as the employee's
 * results — but read for a customer choosing, not an adviser comparing:
 * three tiers, three plans each, the first in every tier marked as its best
 * value, and one button per plan. Opening a plan asks the customer to sign
 * in, because from that point on what they keep is theirs.
 */
export function PublicResultsPage() {
  const [params] = useSearchParams();
  const request = useMemo(() => parseComparisonRequest(params), [params]);
  const comparison = useComparison(request);
  const { customer } = useCustomerSession();
  const criteria = params.toString();

  if (request === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <EmptyState
          title="Tell us who you want to insure"
          description="Start from the compare card on the home page."
          action={<ButtonLink to={`${ROUTES.home}#compare`}>Compare plans</ButtonLink>}
        />
      </div>
    );
  }

  const result = comparison.data;
  const tiers = result ? topPlansByTier(result.plans) : [];
  const total = tiers.reduce((sum, tier) => sum + tier.plans.length, 0);

  const planHref = (plan: ComparisonPlanResult) => {
    const page = `${ROUTES.public.plan(plan.configurationId)}?${criteria}`;
    return customer ? page : loginUrl(page);
  };

  return (
    <div className="pb-8">
      <section className="bg-brand-gradient text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">Your results</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {result
              ? total === 0
                ? 'No plans match yet'
                : `The best ${total === 1 ? 'plan' : 'plans'} for you, tier by tier`
              : 'Comparing every plan on record…'}
          </h1>
          {result ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Chip>{result.criteria.customerTypeLabel}</Chip>
              <Chip>{result.criteria.geographicalCoverageLabel}</Chip>
              <Chip>
                {result.criteria.smeEmployeeCount !== null
                  ? `${formatNumber(result.criteria.smeEmployeeCount)} ${
                      result.criteria.smeEmployeeCount === 1 ? 'employee' : 'employees'
                    }`
                  : result.criteria.ageFrom === result.criteria.ageTo
                    ? `Age ${result.criteria.ageFrom}${result.criteria.ageAssumed ? ' (assumed)' : ''}`
                    : `Ages ${result.criteria.ageFrom}–${result.criteria.ageTo}`}
              </Chip>
              {result.criteria.currency ? <Chip>{result.criteria.currency}</Chip> : null}
              <Link
                to={`${ROUTES.home}#compare`}
                className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-white/85 hover:text-white hover:underline"
              >
                Change details
                <IconChevronRight className="size-4" />
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {comparison.error ? (
          <div className="py-16">
            <EmptyState
              title="Could not compare right now"
              description={describeError(comparison.error, 'the comparison')}
              action={
                <button
                  type="button"
                  onClick={() => void comparison.refetch()}
                  className="text-brand-strong font-semibold hover:underline"
                >
                  Try again
                </button>
              }
            />
          </div>
        ) : !result ? (
          <div className="grid gap-5 py-10 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="bg-surface-muted h-72 animate-pulse rounded-(--radius-card)"
              />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="py-16">
            <EmptyState
              title="No plans match these details"
              description={
                result.blockers[0]?.message ??
                'Try a different age, coverage area or customer type.'
              }
              action={<ButtonLink to={`${ROUTES.home}#compare`}>Change details</ButtonLink>}
            />
          </div>
        ) : (
          <div className="space-y-14 py-10">
            {tiers.map((tier) => (
              <section key={tier.tier} aria-labelledby={`tier-${tier.tier}`}>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2
                      id={`tier-${tier.tier}`}
                      className="text-content flex items-center gap-3 text-2xl font-extrabold tracking-tight"
                    >
                      <TierBadge tier={tier.tier} />
                      {tier.label} plans
                    </h2>
                    <p className="text-content-muted mt-1 text-sm">{tier.description}</p>
                  </div>
                  <p className="text-content-subtle text-sm">
                    {tier.plans.length === 0
                      ? 'None match these details'
                      : `Top ${tier.plans.length} of this tier`}
                  </p>
                </div>

                {tier.plans.length === 0 ? (
                  <p className="text-content-subtle border-border-subtle rounded-(--radius-card) border border-dashed px-4 py-8 text-center text-sm">
                    No {tier.label.toLowerCase()} plan is sold for these details.
                  </p>
                ) : (
                  <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {tier.plans.map((plan, index) => (
                      <PlanCard
                        key={plan.configurationId}
                        plan={plan}
                        tier={tier.tier}
                        rank={index + 1}
                        href={planHref(plan)}
                        signedIn={Boolean(customer)}
                      />
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-(--radius-pill) bg-white/12 px-3 py-1 text-xs font-semibold text-white">
      {children}
    </span>
  );
}

const TIER_STYLE: Record<PlanTierId, { badge: string; ribbon: string }> = {
  BASIC: { badge: 'bg-brand-soft text-brand-strong', ribbon: 'bg-brand-soft text-brand-strong' },
  STANDARD: { badge: 'bg-brand text-content-inverted', ribbon: 'bg-brand text-content-inverted' },
  PREMIUM: {
    badge: 'bg-brand-strong text-content-inverted',
    ribbon: 'bg-brand-strong text-content-inverted',
  },
};

function TierBadge({ tier }: { tier: PlanTierId }) {
  const label = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' }[tier];
  return (
    <span
      className={cn(
        'rounded-(--radius-pill) px-3 py-1 text-xs font-bold tracking-widest uppercase',
        TIER_STYLE[tier].badge,
      )}
    >
      {label}
    </span>
  );
}

function PlanCard({
  plan,
  tier,
  rank,
  href,
  signedIn,
}: {
  plan: ComparisonPlanResult;
  tier: PlanTierId;
  rank: number;
  href: string;
  signedIn: boolean;
}) {
  const covered = plan.benefits.length - plan.missingBenefitCount;
  const best = rank === 1;

  return (
    <li
      className={cn(
        'bg-surface flex flex-col overflow-hidden rounded-(--radius-card) border shadow-(--shadow-card) transition-transform hover:-translate-y-1',
        best ? 'border-brand border-2' : 'border-border-subtle',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between px-5 py-2 text-xs font-bold tracking-wide uppercase',
          best ? TIER_STYLE[tier].ribbon : 'bg-surface-muted text-content-muted',
        )}
      >
        <span>{best ? `Best value · ${TIER_LABEL[tier]}` : TIER_LABEL[tier]}</span>
        <span aria-label={`Rank ${rank}`} className="tabular-nums">
          #{rank}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <CompanyLogo name={plan.companyName} logoUrl={plan.companyLogoUrl} size="md" />
          <div className="min-w-0">
            <p className="text-content-muted truncate text-xs font-medium">{plan.companyName}</p>
            <h3 className="text-content truncate text-lg font-bold">{plan.planName}</h3>
          </div>
        </div>

        <div className="bg-brand-soft/60 rounded-(--radius-control) px-4 py-3">
          <p className="text-brand-strong text-xs font-bold tracking-wide uppercase">
            Annual premium
          </p>
          <p className="text-content mt-0.5 text-2xl font-extrabold tabular-nums">
            {presentPremium(plan)}
          </p>
          <p className="text-content-subtle text-xs">
            {plan.pricedEmployeeCount !== null
              ? `estimated for ${plan.pricedEmployeeCount} ${plan.pricedEmployeeCount === 1 ? 'employee' : 'employees'}`
              : 'per year'}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-content-subtle text-xs">Annual limit</dt>
            <dd className="text-content font-semibold tabular-nums">{presentAnnualLimit(plan)}</dd>
          </div>
          <div>
            <dt className="text-content-subtle text-xs">Coverage</dt>
            <dd className="text-content font-semibold">{plan.geographicalCoverageLabel}</dd>
          </div>
          <div>
            <dt className="text-content-subtle text-xs">Core benefits</dt>
            <dd className="text-content font-semibold">
              {covered} of {plan.benefits.length}
            </dd>
          </div>
          <div>
            <dt className="text-content-subtle text-xs">Network</dt>
            <dd className="text-content truncate font-semibold">
              {plan.medicalNetworkName ?? 'Not specified'}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {plan.isCheapest ? <Badge tone="success">Lowest price</Badge> : null}
          {plan.isHighestCoverage ? <Badge tone="brand">Widest cover</Badge> : null}
        </div>

        <ButtonLink to={href} fullWidth aria-label={`View details for ${plan.planName}`}>
          {signedIn ? 'View details' : 'Sign in to view details'}
          <IconChevronRight className="size-4" />
        </ButtonLink>
      </div>
    </li>
  );
}

const TIER_LABEL: Record<PlanTierId, string> = {
  BASIC: 'Basic',
  STANDARD: 'Standard',
  PREMIUM: 'Premium',
};
