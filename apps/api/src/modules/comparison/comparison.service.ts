import {
  CUSTOMER_TYPES,
  GEOGRAPHICAL_COVERAGES,
  OPTION_FIELD_DATA_TYPES,
  explainRecommendation,
  optionLabel,
  rankValue,
  resolveAverageAgeForCustomerType,
  scoreCandidates,
  type CandidateBenefit,
  type ComparisonCandidate,
  type ComparisonPlanResult,
  type ComparisonPriceRangeDto,
  type ComparisonResultDto,
} from '@aggregator/shared';
import { notFound } from '../../lib/errors.js';
import type { Prisma } from '@prisma/client';
import { toNumber } from '../../lib/decimal.js';
import { getPrisma } from '../../lib/prisma.js';
import { planOptionInclude, toPlanOptionDto } from '../plan-options/plan-options.mapper.js';
import type {
  ComparisonPriceRangePayload,
  ComparisonRequestPayload,
} from './comparison.schemas.js';

/**
 * Every currency a customer could compare in, read from the configurations that
 * actually exist. Nothing is hardcoded: a currency appears here the moment an
 * employee prices a configuration in it.
 */
export async function listComparisonCurrencies(): Promise<string[]> {
  const rows = await getPrisma().planConfiguration.findMany({
    where: { isActive: true, currency: { not: null }, plan: { isActive: true } },
    select: { currency: true },
    distinct: ['currency'],
    orderBy: { currency: 'asc' },
  });
  return rows.flatMap((row) => (row.currency ? [row.currency] : []));
}

/**
 * Everything a configuration must satisfy EXCEPT the budget.
 *
 * The configuration's band must SPAN the ages requested: its `ageFrom` at or
 * below the youngest, its `ageTo` at or above the eldest. A single person is a
 * range of one, so this is the same rule for everybody — and a family is never
 * shown a plan that would leave one of its members outside the cover.
 *
 * Shared so the comparison and the price range can never drift into answering
 * slightly different questions.
 */
function matchingRequirements(input: ComparisonPriceRangePayload) {
  return {
    isActive: true,
    customerType: input.customerTypeId,
    geographicalCoverage: input.geographicalCoverageId,
    currency: input.currency,
    ageFrom: { lte: input.ageFrom },
    ageTo: { gte: input.ageTo },
    plan: {
      isActive: true,
      insuranceTypeId: input.insuranceTypeId,
      company: { isActive: true },
    },
  } as const;
}

/**
 * What the plans matching these requirements cost.
 *
 * One aggregate query. The suggested budget is the dearest matching plan, so
 * asking the system to work a budget out never quietly excludes anything — it
 * simply tells the employee what the market looks like and lets value decide.
 */
export async function getComparisonPriceRange(
  input: ComparisonPriceRangePayload,
): Promise<ComparisonPriceRangeDto> {
  const summary = await getPrisma().planConfiguration.aggregate({
    where: { ...matchingRequirements(input), annualPrice: { not: null } },
    _count: { _all: true },
    _min: { annualPrice: true },
    _max: { annualPrice: true },
  });

  const highestPrice = toNumber(summary._max.annualPrice);

  return {
    count: summary._count._all,
    lowestPrice: toNumber(summary._min.annualPrice),
    highestPrice,
    suggestedBudget: highestPrice,
    currency: input.currency,
  };
}

/**
 * Run a comparison.
 *
 * The order matters and is the order the business asked for: the database
 * narrows to the configurations that match WHO the customer is (insurance
 * type, customer type, coverage area, currency), HOW OLD they are — the
 * configuration's own `ageFrom..ageTo` band — and WHAT THEY CAN SPEND. Only
 * then are benefits looked at.
 *
 * The customer never picks benefits. Whatever the surviving plans carry is
 * what gets compared, so a benefit an employee adds tomorrow appears here with
 * no code change.
 *
 * Two narrow queries run in parallel: the matches, and a count of the ones
 * only the budget excluded, so the screen can say so rather than looking empty.
 */
export async function runComparison(input: ComparisonRequestPayload): Promise<ComparisonResultDto> {
  const prisma = getPrisma();

  const insuranceType = await prisma.insuranceType.findUnique({
    where: { id: input.insuranceTypeId },
    select: { id: true, name: true },
  });
  if (!insuranceType) throw notFound('Insurance type');

  const requirements = matchingRequirements(input);
  const ceiling = input.budget === undefined ? { not: null } : { not: null, lte: input.budget };

  const [configurations, overBudget] = await Promise.all([
    prisma.planConfiguration.findMany({
      where: { ...requirements, annualPrice: ceiling },
      include: configurationForComparison,
      orderBy: [{ annualPrice: 'asc' }, { id: 'asc' }],
    }),
    /**
     * The plans the budget ruled out. Fetched in full rather than counted, so
     * the screen can show what the next bracket up actually buys. Without a
     * ceiling there is nothing above it.
     */
    input.budget === undefined
      ? Promise.resolve([])
      : prisma.planConfiguration.findMany({
          where: { ...requirements, annualPrice: { gt: input.budget } },
          include: configurationForComparison,
          orderBy: [{ annualPrice: 'asc' }, { id: 'asc' }],
        }),
  ]);

  const affordable = compareConfigurations(configurations);
  const dearer = compareConfigurations(overBudget);

  return {
    criteria: {
      insuranceTypeId: insuranceType.id,
      insuranceTypeName: insuranceType.name,
      customerTypeId: input.customerTypeId,
      customerTypeLabel: optionLabel(CUSTOMER_TYPES, input.customerTypeId),
      geographicalCoverageId: input.geographicalCoverageId,
      geographicalCoverageLabel: optionLabel(GEOGRAPHICAL_COVERAGES, input.geographicalCoverageId),
      currency: input.currency,
      ageFrom: input.ageFrom,
      ageTo: input.ageTo,
      budget: input.budget ?? null,
      averageAge: resolveAverageAgeForCustomerType(input.customerTypeId),
      benefits: affordable.benefits,
    },
    plans: affordable.plans,
    recommendedConfigurationId: affordable.recommendedConfigurationId,
    recommendationReasons: affordable.reasons,
    matchedCount: affordable.plans.length,

    overBudgetPlans: dearer.plans,
    overBudgetBenefits: dearer.benefits,
    overBudgetRecommendedConfigurationId: dearer.recommendedConfigurationId,
    overBudgetRecommendationReasons: dearer.reasons,
    overBudgetCount: dearer.plans.length,
  };
}

/** Relations every compared configuration is read with. */
const configurationForComparison = {
  plan: {
    select: {
      id: true,
      name: true,
      company: { select: { id: true, name: true, logoUrl: true } },
    },
  },
  // Every benefit these plans carry — the customer chose none of them.
  options: { include: planOptionInclude, orderBy: { sortOrder: 'asc' as const } },
} as const;

type ConfigurationForComparison = Prisma.PlanConfigurationGetPayload<{
  include: typeof configurationForComparison;
}>;

/**
 * Turn a set of configurations into a scored comparison.
 *
 * Called once per set — those within the budget and those above it — so each
 * is normalised against its own peers. That is what makes "best value above
 * your budget" a real statement rather than a leftover, and it keeps plans the
 * customer cannot afford from influencing the recommendation among the ones
 * they can.
 */
function compareConfigurations(configurations: ConfigurationForComparison[]): {
  benefits: { id: string; name: string }[];
  plans: ComparisonPlanResult[];
  recommendedConfigurationId: string | null;
  reasons: string[];
} {
  /**
   * The benefits to compare, discovered from these plans themselves. One
   * column per distinct benefit, ordered as the catalogue orders them so every
   * plan's row lines up.
   */
  const discovered = new Map<string, { id: string; name: string; sortOrder: number }>();
  for (const configuration of configurations) {
    for (const planOption of configuration.options) {
      /**
       * A group of benefits is a heading, not cover: it holds no value, so a
       * column for it would read "not covered" against every plan. Its
       * sub-benefits are ordinary benefits and are compared on their own.
       */
      if (planOption.option.isUmbrella) continue;
      if (discovered.has(planOption.optionId)) continue;
      discovered.set(planOption.optionId, {
        id: planOption.optionId,
        name: planOption.option.name,
        sortOrder: planOption.option.sortOrder,
      });
    }
  }
  const benefits = [...discovered.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );

  const candidates: ComparisonCandidate[] = configurations.map((configuration) => {
    const attached = new Map(
      configuration.options.map((planOption) => [planOption.optionId, toPlanOptionDto(planOption)]),
    );

    const cells: CandidateBenefit[] = benefits.map((benefit) => {
      const planOption = attached.get(benefit.id);
      /**
       * A benefit is ranked on the first value it declares that can be ranked
       * at all. Free text carries no scale, so a benefit whose only field is
       * text is ranked on its limitations instead — see `carried` below.
       */
      const cell = planOption?.values.find(
        (value) => OPTION_FIELD_DATA_TYPES[value.dataType].comparison !== 'NOT_COMPARABLE',
      );
      const wording = planOption?.values.find((value) => typeof value.value === 'string');

      /**
       * A ranked answer becomes a number here, from its place in the list the
       * employee ordered. "Golden Care Network" carries no figure, but sitting
       * above "Orange Care Network" is exactly what makes it better cover —
       * and this is the only place that has both the answer and the list.
       */
      const ranked =
        cell?.dataType === 'RANK'
          ? rankValue(typeof cell.value === 'string' ? cell.value : null, cell.choices ?? [])
          : null;

      return {
        optionId: benefit.id,
        optionName: benefit.name,
        value: ranked ?? (typeof cell?.value === 'number' ? cell.value : null),
        dataType: cell?.dataType ?? null,
        unit: cell?.unit ?? null,
        /**
         * Whether this plan carries the benefit AT ALL — which is simply
         * whether it is attached. A plan listing "Physiotherapy: covered at
         * authorized centers" provides something the plan that omits it does
         * not, and until the engine could tell the two apart both scored zero.
         */
        carried: planOption !== undefined,
        textValue:
          cell?.dataType === 'RANK'
            ? (cell.choiceLabel ?? null)
            : typeof wording?.value === 'string'
              ? wording.value
              : null,
        /**
         * The restrictions this plan records, read off the benefit's OWN
         * settings.
         *
         * Every MULTI setting the benefit has is a list of answers ranked
         * mildest-first, so a ticked answer's position in its own list is what
         * it costs. Empty means nothing was recorded, which for a restriction
         * is unqualified cover.
         */
        limitations: (planOption?.values ?? [])
          .filter((value) => value.dataType === 'MULTI')
          .flatMap((value) =>
            (value.selectedChoiceIds ?? []).flatMap((choiceId) => {
              const answer = (value.choices ?? []).find((choice) => choice.id === choiceId);
              return answer
                ? [
                    {
                      id: answer.id,
                      name: answer.label,
                      rank: answer.sortOrder,
                      rankCount: answer.rankCount,
                    },
                  ]
                : [];
            }),
          ),
      };
    });

    return {
      configurationId: configuration.id,
      planId: configuration.plan.id,
      planName: configuration.plan.name,
      companyId: configuration.plan.company.id,
      companyName: configuration.plan.company.name,
      companyLogoUrl: configuration.plan.company.logoUrl,
      currency: configuration.currency,
      annualPrice: toNumber(configuration.annualPrice),
      annualLimit: toNumber(configuration.annualLimit),
      deductible: toNumber(configuration.deductible),
      coPayment: toNumber(configuration.coPayment),
      customerTypeLabel: optionLabel(CUSTOMER_TYPES, configuration.customerType),
      geographicalCoverageLabel: optionLabel(
        GEOGRAPHICAL_COVERAGES,
        configuration.geographicalCoverage,
      ),
      benefits: cells,
    };
  });

  const plans = scoreCandidates(candidates);

  return {
    benefits: benefits.map((benefit) => ({ id: benefit.id, name: benefit.name })),
    plans,
    recommendedConfigurationId: plans.find((plan) => plan.isRecommended)?.configurationId ?? null,
    reasons: explainRecommendation(plans),
  };
}
