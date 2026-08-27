/**
 * In-memory stand-in for the API, installed as `globalThis.fetch`.
 *
 * It implements the same contract as the real Express API (the `ApiResponse`
 * envelope, `Paginated<T>` lists, the same routes), so page components are
 * exercised exactly as they will run in production — but nothing is written to
 * any database. This is test scaffolding, NOT seed data: the store starts
 * empty in every test and disappears with the process.
 */

import {
  benefitValueField,
  DEFAULT_BENEFIT_VALUE_KIND,
  resolveAverageAgeForCustomerType,
  type BenefitValueKind,
  type CompanyDto,
  type InsuranceOptionDto,
  type InsuranceTypeDto,
  type OptionFieldDto,
  type PlanConfigurationDto,
  type PlanDto,
  type PlanOptionDto,
} from '@aggregator/shared';

interface StoredValue {
  planOptionId: string;
  optionFieldId: string;
  value: number | string | boolean | null;
}

interface StoredPlanOption {
  id: string;
  planConfigurationId: string;
  optionId: string;
  sortOrder: number;
}

export interface FakeStore {
  companies: CompanyDto[];
  insuranceTypes: InsuranceTypeDto[];
  options: InsuranceOptionDto[];
  plans: PlanDto[];
  configurations: PlanConfigurationDto[];
  planOptions: StoredPlanOption[];
  values: StoredValue[];
  /**
   * Set to make the next matching request fail, e.g. to test error states.
   * `delayMs` holds the response back, which is what makes an optimistic UI
   * state observable before the failure arrives.
   */
  failNext: {
    method: string;
    path: RegExp;
    status: number;
    body: unknown;
    delayMs?: number;
  } | null;
}

export function createStore(): FakeStore {
  return {
    companies: [],
    insuranceTypes: [],
    options: [],
    plans: [],
    configurations: [],
    planOptions: [],
    values: [],
    failNext: null,
  };
}

let counter = 0;
const id = (prefix: string) => `${prefix}_${(counter += 1)}`;
const now = () => new Date(0).toISOString();

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** 204 responses must carry no body — `new Response(body, {status:204})` throws. */
const noContent = () => new Response(null, { status: 204 });

const fail = (status: number, code: string, message: string, details?: Record<string, string[]>) =>
  new Response(
    JSON.stringify({ ok: false, error: { code, message, ...(details ? { details } : {}) } }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );

const page = <T>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 200 });

const meta = () => ({ isActive: true, createdAt: now(), updatedAt: now() });

/** Install the fake API for the duration of a test. Returns the store. */
export function installFakeApi(store: FakeStore = createStore()): FakeStore {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : String(input), 'http://localhost');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, never>) : {};

    if (store.failNext && store.failNext.method === method && store.failNext.path.test(path)) {
      const { status, body: failBody, delayMs } = store.failNext;
      store.failNext = null;
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return new Response(JSON.stringify(failBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return (
      route({ store, path, method, body, search: url.searchParams }) ??
      fail(404, 'NOT_FOUND', 'No route')
    );
  }) as typeof fetch;

  return store;
}

function route({
  store,
  path,
  method,
  body,
  search,
}: {
  store: FakeStore;
  path: string;
  method: string;
  body: Record<string, never>;
  search: URLSearchParams;
}): Response | null {
  const segments = path.split('/').filter(Boolean);
  const [resource, first, second, third] = segments;

  // --- companies -----------------------------------------------------------
  if (resource === 'companies') {
    if (method === 'GET' && !first) return ok(page(store.companies));
    if (method === 'POST') {
      if (!body.name) {
        return fail(400, 'VALIDATION_ERROR', 'The request payload is invalid.', {
          name: ['String must contain at least 1 character(s)'],
        });
      }
      const company = { id: id('company'), ...meta(), ...blankCompany(), ...body } as CompanyDto;
      store.companies.push(company);
      return ok(company, 201);
    }
    const existing = store.companies.find((company) => company.id === first);
    if (!existing) return fail(404, 'NOT_FOUND', 'The record was not found.');
    if (method === 'GET') return ok(existing);
    if (method === 'PATCH') {
      Object.assign(existing, body);
      return ok(existing);
    }
    if (method === 'DELETE') {
      store.companies = store.companies.filter((company) => company.id !== first);
      return noContent();
    }
  }

  // --- insurance types -----------------------------------------------------
  if (resource === 'insurance-types') {
    if (method === 'GET' && !first) return ok(page(store.insuranceTypes));
    if (method === 'POST') {
      const type: InsuranceTypeDto = {
        id: id('type'),
        name: String(body.name ?? ''),
        code: String(body.name ?? '')
          .toLowerCase()
          .replace(/\W+/g, '_'),
        description: (body.description as string | null) ?? null,
        sortOrder: store.insuranceTypes.length,
        ...meta(),
      };
      store.insuranceTypes.push(type);
      return ok(type, 201);
    }
  }

  // --- insurance options ---------------------------------------------------
  if (resource === 'insurance-options') {
    /**
     * The catalogue is global: no company or type narrows it. Sub-benefits are
     * returned inside their umbrella, exactly as the real API returns them.
     */
    if (method === 'GET' && !first) {
      const withUsage = (option: InsuranceOptionDto): InsuranceOptionDto => ({
        ...option,
        usageCount: store.planOptions.filter((item) => item.optionId === option.id).length,
      });
      return ok(
        page(
          store.options
            .filter((option) => !option.parentId)
            .map((option) => ({
              ...withUsage(option),
              ...(option.isUmbrella
                ? {
                    children: store.options
                      .filter((child) => child.parentId === option.id)
                      .map(withUsage),
                  }
                : {}),
            })),
        ),
      );
    }
    if (method === 'POST' && !first) {
      const optionId = id('option');
      const isUmbrella = Boolean(body.isUmbrella);
      const parentId = (body.parentId as string | undefined) ?? null;
      /**
       * A benefit created without explicit fields gets the single field of the
       * kind it was created with; an umbrella gets none, because it carries
       * nothing itself.
       */
      const inlineFields = (isUmbrella
        ? []
        : (body.fields as unknown[] | undefined)?.length
          ? body.fields
          : [
              benefitValueField(
                (body.valueKind as BenefitValueKind | undefined) ?? DEFAULT_BENEFIT_VALUE_KIND,
              ),
            ]) as unknown as {
        label: string;
        dataType: OptionFieldDto['dataType'];
        unit?: string | null;
      }[];
      const name = String(body.name ?? '');
      // Global uniqueness, as the real API enforces it.
      if (store.options.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        return fail(409, 'DUPLICATE', 'This benefit already exists.');
      }

      const option: InsuranceOptionDto = {
        id: optionId,
        name,
        description: (body.description as string | null) ?? null,
        sortOrder: store.options.length,
        isUmbrella,
        parentId,
        fields: inlineFields.map((field, index) => ({
          id: id('field'),
          optionId,
          label: field.label,
          key: field.label.toLowerCase().replace(/\W+/g, '_'),
          dataType: field.dataType,
          unit: field.unit ?? null,
          helpText: null,
          isRequired: false,
          sortOrder: index,
          ...meta(),
        })),
        ...meta(),
      };
      store.options.push(option);
      return ok(option, 201);
    }
    const option = store.options.find((item) => item.id === first);
    if (!option) return fail(404, 'NOT_FOUND', 'The record was not found.');
    if (method === 'GET' && !second) return ok(option);
    if (method === 'DELETE' && !second) {
      /**
       * As the real API: a group goes with everything filed under it, and
       * anything still in use needs an explicit `force`.
       */
      const optionIds = [
        option.id,
        ...store.options.filter((item) => item.parentId === option.id).map((item) => item.id),
      ];
      const usage = store.planOptions.filter((item) => optionIds.includes(item.optionId));

      if (search.get('force') !== 'true') {
        if (usage.length > 0) {
          return fail(
            409,
            'CONFLICT',
            `This benefit is used by ${usage.length} plan configuration(s) and cannot be deleted. Deactivate it instead.`,
          );
        }
        if (optionIds.length > 1) {
          return fail(409, 'CONFLICT', 'This group holds sub-benefits.');
        }
      }

      const removedPlanOptionIds = usage.map((item) => item.id);
      store.planOptions = store.planOptions.filter(
        (item) => !removedPlanOptionIds.includes(item.id),
      );
      store.values = store.values.filter(
        (value) => !removedPlanOptionIds.includes(value.planOptionId),
      );
      store.options = store.options.filter((item) => !optionIds.includes(item.id));
      return noContent();
    }
    if (method === 'PATCH') {
      // Global uniqueness applies to a rename too, as the real API enforces it.
      const name = body.name as string | undefined;
      if (
        name !== undefined &&
        store.options.some(
          (item) => item.id !== option.id && item.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        return fail(409, 'DUPLICATE', 'This benefit already exists.');
      }

      /**
       * Changing what a benefit carries rewrites its one field in place — the
       * plans keep pointing at the same field — and brings the recorded values
       * across, dropping only what the new kind cannot hold.
       */
      const kind = body.valueKind as BenefitValueKind | undefined;
      const field = option.fields?.[0];
      if (kind && field) {
        const target = benefitValueField(kind);
        for (const value of store.values.filter((item) => item.optionFieldId === field.id)) {
          if (target.dataType === 'TEXT') {
            value.value = typeof value.value === 'number' ? String(value.value) : value.value;
          } else if (typeof value.value === 'string') {
            const parsed = Number(value.value.replace(/,/g, ''));
            value.value = value.value.trim() !== '' && !Number.isNaN(parsed) ? parsed : null;
          } else if (target.dataType === 'PERCENTAGE' && typeof value.value === 'number') {
            value.value = value.value > 100 ? null : value.value;
          }
        }
        Object.assign(field, {
          label: target.label,
          key: target.key,
          dataType: target.dataType,
          unit: target.unit,
        });
      }

      const { valueKind: _ignored, ...rest } = body as Record<string, unknown>;
      Object.assign(option, rest);
      return ok(option);
    }
    if (second === 'fields' && method === 'POST') {
      const field: OptionFieldDto = {
        id: id('field'),
        optionId: option.id,
        label: String(body.label ?? ''),
        key: String(body.label ?? '')
          .toLowerCase()
          .replace(/\W+/g, '_'),
        dataType: (body.dataType ?? 'NUMBER') as OptionFieldDto['dataType'],
        unit: (body.unit as string | null) ?? null,
        helpText: (body.helpText as string | null) ?? null,
        isRequired: Boolean(body.isRequired),
        sortOrder: option.fields?.length ?? 0,
        ...meta(),
      };
      option.fields = [...(option.fields ?? []), field];
      return ok(field, 201);
    }
  }

  // --- option fields addressed directly ------------------------------------
  if (resource === 'option-fields' && first) {
    const owner = store.options.find((option) => option.fields?.some((f) => f.id === first));
    if (!owner) return fail(404, 'NOT_FOUND', 'The record was not found.');
    if (method === 'PATCH') {
      const field = owner.fields!.find((f) => f.id === first)!;
      Object.assign(field, body);
      return ok(field);
    }
    if (method === 'DELETE') {
      owner.fields = owner.fields!.filter((f) => f.id !== first);
      return noContent();
    }
  }

  // --- comparison ----------------------------------------------------------
  /**
   * Enough of the real contract for the results screen: configurations are
   * split by the budget, each side scored on its own, one recommendation per
   * side. The real ranking lives in `@aggregator/shared` and is tested there.
   */
  if (resource === 'comparison' && !first && method === 'POST') {
    const budget = body.budget as number | undefined;
    const toPlan = (configuration: PlanConfigurationDto, recommended: boolean) => {
      const options = store.planOptions.filter((p) => p.planConfigurationId === configuration.id);
      const plan = store.plans.find((item) => item.id === configuration.planId);
      const company = store.companies.find((item) => item.id === plan?.companyId);
      return {
        configurationId: configuration.id,
        planId: plan?.id ?? '',
        planName: plan?.name ?? '',
        companyId: company?.id ?? '',
        companyName: company?.name ?? '',
        companyLogoUrl: null,
        currency: configuration.currency,
        annualPrice: configuration.annualPrice,
        customerTypeLabel: configuration.customerType,
        geographicalCoverageLabel: configuration.geographicalCoverage,
        benefits: options.map((planOption) => {
          const option = store.options.find((item) => item.id === planOption.optionId);
          const value = store.values.find((v) => v.planOptionId === planOption.id)?.value ?? null;
          return {
            optionId: planOption.optionId,
            optionName: option?.name ?? '',
            covered: value !== null,
            value: typeof value === 'number' ? value : null,
            display: typeof value === 'number' ? `${value}%` : 'Not covered',
            dataType: 'PERCENTAGE',
            unit: '%',
            direction: 'HIGHER_IS_BETTER',
            score: typeof value === 'number' ? 1 : 0,
            isBest: false,
          };
        }),
        attributes: [],
        coverageScore: 1,
        priceScore: 1,
        valueScore: 1,
        missingBenefitCount: 0,
        isDominated: false,
        dominatedBy: [],
        isRecommended: recommended,
        isCheapest: false,
        isHighestCoverage: false,
      };
    };

    const priced = store.configurations.filter((c) => typeof c.annualPrice === 'number');
    const within = budget === undefined ? priced : priced.filter((c) => c.annualPrice! <= budget);
    const above = budget === undefined ? [] : priced.filter((c) => c.annualPrice! > budget);
    const namesOf = (configurations: PlanConfigurationDto[]) => {
      const ids = new Set(
        store.planOptions
          .filter((p) => configurations.some((c) => c.id === p.planConfigurationId))
          .map((p) => p.optionId),
      );
      return store.options.filter((o) => ids.has(o.id)).map((o) => ({ id: o.id, name: o.name }));
    };

    return ok({
      criteria: {
        insuranceTypeId: String(body.insuranceTypeId ?? ''),
        insuranceTypeName: store.insuranceTypes[0]?.name ?? '',
        customerTypeId: body.customerTypeId,
        customerTypeLabel: String(body.customerTypeId ?? ''),
        geographicalCoverageId: body.geographicalCoverageId,
        geographicalCoverageLabel: String(body.geographicalCoverageId ?? ''),
        currency: String(body.currency ?? ''),
        ageFrom: Number(body.ageFrom ?? 0),
        ageTo: Number(body.ageTo ?? 0),
        budget: budget ?? null,
        averageAge: { value: null, source: 'NOT_SPECIFIED', label: null },
        benefits: namesOf(within),
      },
      plans: within.map((c, index) => toPlan(c, index === 0)),
      recommendedConfigurationId: within[0]?.id ?? null,
      recommendationReasons: within.length ? ['Best value within the budget.'] : [],
      matchedCount: within.length,
      overBudgetPlans: above.map((c, index) => toPlan(c, index === 0)),
      overBudgetBenefits: namesOf(above),
      overBudgetRecommendedConfigurationId: above[0]?.id ?? null,
      overBudgetRecommendationReasons: above.length ? ['Best value above the budget.'] : [],
      overBudgetCount: above.length,
    });
  }

  if (resource === 'comparison' && first === 'price-range' && method === 'POST') {
    const prices = store.configurations
      .filter(
        (configuration) =>
          configuration.customerType === body.customerType ||
          configuration.customerType === body.customerTypeId,
      )
      .map((configuration) => configuration.annualPrice)
      .filter((price): price is number => typeof price === 'number');

    return ok({
      count: prices.length,
      lowestPrice: prices.length ? Math.min(...prices) : null,
      highestPrice: prices.length ? Math.max(...prices) : null,
      suggestedBudget: prices.length ? Math.max(...prices) : null,
      currency: String(body.currency ?? ''),
    });
  }

  // --- plans ---------------------------------------------------------------
  if (resource === 'plans') {
    if (method === 'GET' && !first) {
      const companyFilter = search.get('companyId');
      return ok(
        page(store.plans.filter((plan) => !companyFilter || plan.companyId === companyFilter)),
      );
    }
    if (method === 'POST' && !first) {
      const plan: PlanDto = {
        id: id('plan'),
        companyId: String(body.companyId ?? ''),
        insuranceTypeId: String(body.insuranceTypeId ?? ''),
        name: String(body.name ?? ''),
        code: String(body.code ?? ''),
        description: (body.description as string | null) ?? null,
        ...meta(),
      };
      store.plans.push(plan);
      return ok(plan, 201);
    }
    const plan = store.plans.find((item) => item.id === first);
    if (!plan) return fail(404, 'NOT_FOUND', 'The record was not found.');
    if (method === 'GET') {
      return ok({
        ...plan,
        configurations: store.configurations
          .filter((configuration) => configuration.planId === plan.id)
          .map((configuration) => hydrateConfiguration(store, configuration)),
      });
    }
    if (method === 'PATCH') {
      Object.assign(plan, body);
      return ok(plan);
    }
    if (method === 'DELETE') {
      store.plans = store.plans.filter((item) => item.id !== plan.id);
      store.configurations = store.configurations.filter((c) => c.planId !== plan.id);
      return noContent();
    }
  }

  // --- plan configurations -------------------------------------------------
  if (resource === 'plan-configurations') {
    if (method === 'GET' && !first) {
      const planFilter = search.get('planId');
      return ok(
        page(
          store.configurations
            .filter((c) => !planFilter || c.planId === planFilter)
            .map((c) => hydrateConfiguration(store, c)),
        ),
      );
    }
    if (method === 'POST' && !first) {
      // The age band is required and has to run forwards, as the real API says.
      const ageFrom = body.ageFrom as number | null | undefined;
      const ageTo = body.ageTo as number | null | undefined;
      if (typeof ageFrom !== 'number' || typeof ageTo !== 'number') {
        return fail(422, 'VALIDATION_ERROR', 'The request payload is invalid.', {
          ...(typeof ageFrom !== 'number' ? { ageFrom: ['Required'] } : {}),
          ...(typeof ageTo !== 'number' ? { ageTo: ['Required'] } : {}),
        });
      }
      if (ageFrom > ageTo) {
        return fail(422, 'VALIDATION_ERROR', 'The request payload is invalid.', {
          ageFrom: ['Age From cannot be greater than Age To.'],
        });
      }

      const duplicate = store.configurations.some(
        (configuration) =>
          configuration.planId === body.planId &&
          configuration.customerType === body.customerType &&
          configuration.geographicalCoverage === body.geographicalCoverage &&
          configuration.ageFrom === ageFrom &&
          configuration.ageTo === ageTo,
      );
      if (duplicate) {
        return fail(409, 'DUPLICATE', 'A record with this planId, customerType already exists.');
      }
      const configuration: PlanConfigurationDto = {
        id: id('configuration'),
        planId: String(body.planId ?? ''),
        customerType: body.customerType as PlanConfigurationDto['customerType'],
        geographicalCoverage:
          body.geographicalCoverage as PlanConfigurationDto['geographicalCoverage'],
        ageFrom: body.ageFrom as number,
        ageTo: body.ageTo as number,
        currency: (body.currency as string | null) ?? null,
        annualPrice: (body.annualPrice as number | null) ?? null,
        annualLimit: (body.annualLimit as number | null) ?? null,
        deductible: (body.deductible as number | null) ?? null,
        coPayment: (body.coPayment as number | null) ?? null,
        averageAge: resolveAverageAgeForCustomerType(
          body.customerType as PlanConfigurationDto['customerType'],
        ),
        ...meta(),
      };
      store.configurations.push(configuration);
      return ok(configuration, 201);
    }
    const configuration = store.configurations.find((item) => item.id === first);
    if (!configuration) return fail(404, 'NOT_FOUND', 'The record was not found.');
    if (method === 'GET' && !second) return ok(hydrateConfiguration(store, configuration));
    /** The same cover at another age: benefits and their values come with it. */
    if (second === 'duplicate' && method === 'POST') {
      const copy: PlanConfigurationDto = {
        ...configuration,
        id: id('configuration'),
        ageFrom: body.ageFrom as number,
        ageTo: body.ageTo as number,
        ...(body.annualPrice === undefined
          ? {}
          : { annualPrice: body.annualPrice as number | null }),
        ...(body.annualLimit === undefined
          ? {}
          : { annualLimit: body.annualLimit as number | null }),
        ...(body.deductible === undefined ? {} : { deductible: body.deductible as number | null }),
        ...(body.coPayment === undefined ? {} : { coPayment: body.coPayment as number | null }),
      };
      store.configurations.push(copy);

      for (const planOption of store.planOptions.filter(
        (item) => item.planConfigurationId === configuration.id,
      )) {
        const copied: StoredPlanOption = {
          id: id('planOption'),
          planConfigurationId: copy.id,
          optionId: planOption.optionId,
          sortOrder: planOption.sortOrder,
        };
        store.planOptions.push(copied);
        for (const value of store.values.filter((item) => item.planOptionId === planOption.id)) {
          store.values.push({ ...value, planOptionId: copied.id });
        }
      }

      return ok(hydrateConfiguration(store, copy), 201);
    }
    if (method === 'PATCH') {
      Object.assign(configuration, body);
      return ok(hydrateConfiguration(store, configuration));
    }
    // Checked before the add-option branch, which would otherwise match too.
    if (second === 'options' && third === 'reorder' && method === 'POST') {
      (body.orderedIds as unknown as string[]).forEach((planOptionId, index) => {
        const target = store.planOptions.find((item) => item.id === planOptionId);
        if (target) target.sortOrder = index;
      });
      return noContent();
    }
    if (second === 'options' && method === 'POST') {
      const option = store.options.find((item) => item.id === String(body.optionId ?? ''));
      if (!option) return fail(404, 'NOT_FOUND', 'The record was not found.');

      /**
       * As the real API does: a group is attached with its parts, and a part is
       * attached with the group that heads it. The response is therefore a
       * list, even for an ordinary benefit.
       */
      const optionIds = option.isUmbrella
        ? [option.id, ...store.options.filter((c) => c.parentId === option.id).map((c) => c.id)]
        : option.parentId
          ? [option.parentId, option.id]
          : [option.id];

      const created = optionIds.map((optionId) => {
        const existing = store.planOptions.find(
          (item) => item.planConfigurationId === configuration.id && item.optionId === optionId,
        );
        if (existing) return existing;
        const planOption: StoredPlanOption = {
          id: id('planOption'),
          planConfigurationId: configuration.id,
          optionId,
          sortOrder: store.planOptions.filter(
            (item) => item.planConfigurationId === configuration.id,
          ).length,
        };
        store.planOptions.push(planOption);
        return planOption;
      });

      return ok(
        created.map((planOption) => hydratePlanOption(store, planOption)),
        201,
      );
    }
    if (method === 'DELETE' && !second) {
      store.configurations = store.configurations.filter((item) => item.id !== configuration.id);
      store.planOptions = store.planOptions.filter(
        (item) => item.planConfigurationId !== configuration.id,
      );
      return noContent();
    }
  }

  // --- plan options --------------------------------------------------------
  if (resource === 'plan-options') {
    const planOption = store.planOptions.find((item) => item.id === first);
    if (!planOption) return fail(404, 'NOT_FOUND', 'The record was not found.');
    if (second === 'values' && method === 'PUT') {
      store.values = store.values.filter((value) => value.planOptionId !== planOption.id);
      for (const entry of body.values as unknown as {
        optionFieldId: string;
        value: number | string | boolean | null;
      }[]) {
        store.values.push({ planOptionId: planOption.id, ...entry });
      }
      return ok(hydratePlanOption(store, planOption));
    }
    if (method === 'DELETE') {
      // Exactly one attachment, as the real API does: a group and its parts are
      // removed by the clicks that name them, never one by another.
      store.planOptions = store.planOptions.filter((item) => item.id !== planOption.id);
      store.values = store.values.filter((value) => value.planOptionId !== planOption.id);
      return noContent();
    }
  }

  return null;
}

function hydrateConfiguration(
  store: FakeStore,
  configuration: PlanConfigurationDto,
): PlanConfigurationDto {
  return {
    ...configuration,
    averageAge: resolveAverageAgeForCustomerType(configuration.customerType),
    options: store.planOptions
      .filter((planOption) => planOption.planConfigurationId === configuration.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((planOption) => hydratePlanOption(store, planOption)),
  };
}

/** Mirrors the API: one entry per active field, whether or not a value exists. */
function hydratePlanOption(store: FakeStore, planOption: StoredPlanOption): PlanOptionDto {
  const option = store.options.find((item) => item.id === planOption.optionId);
  const fields = option?.fields ?? [];

  return {
    id: planOption.id,
    planConfigurationId: planOption.planConfigurationId,
    optionId: planOption.optionId,
    optionName: option?.name ?? 'Unknown',
    isUmbrella: option?.isUmbrella ?? false,
    parentOptionId: option?.parentId ?? null,
    sortOrder: planOption.sortOrder,
    createdAt: now(),
    updatedAt: now(),
    values: fields.map((field) => {
      const stored = store.values.find(
        (value) => value.planOptionId === planOption.id && value.optionFieldId === field.id,
      );
      return {
        id: stored ? `${planOption.id}:${field.id}` : '',
        optionFieldId: field.id,
        fieldKey: field.key,
        fieldLabel: field.label,
        dataType: field.dataType,
        unit: field.unit,
        value: stored?.value ?? null,
      };
    }),
  };
}

function blankCompany() {
  return {
    shortName: null,
    logoUrl: null,
    description: null,
    website: null,
    email: null,
    phone: null,
    mobile: null,
    address: null,
  };
}
