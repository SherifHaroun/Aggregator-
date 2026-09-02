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
  ALTERNATIVE_VALUE_KEY,
  alternativeValueField,
  benefitValueField,
  DEFAULT_BENEFIT_VALUE_KIND,
  derivePlanCode,
  medicalBenefitSpec,
  quoteSmeWorkforce,
  resolveAverageAgeForCustomerType,
  totalSmeEmployees,
  type BenefitValueKind,
  type CompanyDto,
  type CompanyMedicalNetworkDto,
  type InsuranceOptionDto,
  type InsuranceTypeDto,
  type OptionChoiceDto,
  type OptionFieldDto,
  type PlanConfigurationDto,
  type PlanDto,
  type PlanOptionDto,
  type PlanOptionValueDto,
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
  note?: string | null;
  /** Ids of the answers ticked on this benefit, across all its settings. */
  tickedChoiceIds?: string[];
}

export interface FakeStore {
  companies: CompanyDto[];
  /** Provider networks, each owned by one company. Never shared between them. */
  medicalNetworks: CompanyMedicalNetworkDto[];
  insuranceTypes: InsuranceTypeDto[];
  options: InsuranceOptionDto[];
  /** The answers settings offer, across every setting. */
  choices: OptionChoiceDto[];
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
    medicalNetworks: [],
    insuranceTypes: [],
    options: [],
    choices: [],
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

/**
 * A plan sold on another company's network is a false statement about what the
 * customer gets, so the real API refuses it. The fake refuses it too, or a test
 * could pass against a contract production does not honour.
 */
function foreignNetwork(
  store: FakeStore,
  companyId: string,
  medicalNetworkId: string | null,
): Response | null {
  if (!medicalNetworkId) return null;
  const owned = store.medicalNetworks.some(
    (network) => network.id === medicalNetworkId && network.companyId === companyId,
  );
  return owned ? null : fail(400, 'BAD_REQUEST', 'That network belongs to a different company.');
}

/** Resolve the network's name, as the real API does when reading a variant. */
function networkName(
  store: FakeStore,
  configuration: PlanConfigurationDto,
): PlanConfigurationDto {
  return {
    ...configuration,
    medicalNetworkName:
      store.medicalNetworks.find((network) => network.id === configuration.medicalNetworkId)
        ?.name ?? null,
  };
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
  const [resource, first, second, third, fourth] = segments;

  // --- companies -----------------------------------------------------------
  if (resource === 'companies') {
    /**
     * The provider networks THIS company sells, nested under it because the
     * list is the company's own. Matched before the plain company routes, which
     * would otherwise answer `/companies/:id/medical-networks` with the company.
     */
    if (second === 'medical-networks') {
      const owned = () =>
        store.medicalNetworks
          .filter((network) => network.companyId === first)
          .sort((a, b) => a.sortOrder - b.sortOrder);
      // Variants, not plans: one plan may be sold on two networks.
      const soldOn = (networkId: string) =>
        store.configurations.filter((item) => item.medicalNetworkId === networkId).length;

      if (method === 'GET' && !third) {
        return ok(owned().map((network) => ({ ...network, variantCount: soldOn(network.id) })));
      }

      if (method === 'POST' && !third) {
        const name = String(body.name ?? '').trim();
        // Unique within the company only: another insurer may sell the name too.
        if (owned().some((network) => network.name.toLowerCase() === name.toLowerCase())) {
          return fail(409, 'DUPLICATE', `This company already has a network called "${name}".`);
        }
        const network: CompanyMedicalNetworkDto = {
          id: id('network'),
          companyId: String(first),
          name,
          description: null,
          // At the END: a network nobody has ranked yet is not the best one.
          sortOrder: owned().length,
          ...meta(),
        };
        store.medicalNetworks.push(network);
        return ok(network, 201);
      }

      if (method === 'POST' && third === 'reorder') {
        const orderedIds = (body.orderedIds as unknown as string[]) ?? [];
        if (orderedIds.some((networkId) => !owned().some((n) => n.id === networkId))) {
          return fail(
            400,
            'BAD_REQUEST',
            'The list contains networks that do not belong to this company.',
          );
        }
        orderedIds.forEach((networkId, index) => {
          const network = store.medicalNetworks.find((n) => n.id === networkId);
          if (network) network.sortOrder = index;
        });
        return noContent();
      }

      const network = owned().find((item) => item.id === third);
      if (!network) return fail(404, 'NOT_FOUND', 'The record was not found.');
      if (method === 'PATCH') {
        Object.assign(network, body);
        return ok({ ...network, planCount: soldOn(network.id) });
      }
      if (method === 'DELETE') {
        const usage = soldOn(network.id);
        if (usage > 0 && search.get('force') !== 'true') {
          return fail(
            409,
            'CONFLICT',
            `${usage} ${usage === 1 ? 'plan is' : 'plans are'} sold on "${network.name}".`,
          );
        }
        // The variants survive; they simply stop naming a network.
        store.configurations.forEach((item) => {
          if (item.medicalNetworkId === network.id) item.medicalNetworkId = null;
        });
        store.medicalNetworks = store.medicalNetworks.filter((item) => item.id !== network.id);
        return noContent();
      }
    }

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
        fields: (option.fields ?? []).map((field) => ({
          ...field,
          choices: choicesFor(store, field.id),
        })),
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
      const alternativeKind = body.alternativeKind as BenefitValueKind | undefined;
      const inlineFields = (isUmbrella
        ? []
        : (body.fields as unknown[] | undefined)?.length
          ? body.fields
          : [
              benefitValueField(
                (body.valueKind as BenefitValueKind | undefined) ?? DEFAULT_BENEFIT_VALUE_KIND,
              ),
              // A benefit quoted two ways carries a second field.
              ...(alternativeKind ? [alternativeValueField(alternativeKind)] : []),
            ]) as unknown as {
        label: string;
        key?: string;
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
          key: field.key ?? field.label.toLowerCase().replace(/\W+/g, '_'),
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
    /**
     * A field's answers travel with it, as they do from the list endpoint.
     * Without them the edit dialog reads an empty answer list and offers no
     * way to reorder or remove one — a gap in the double, not in the product.
     */
    if (method === 'GET' && !second)
      return ok({
        ...option,
        fields: (option.fields ?? []).map((field) => ({
          ...field,
          choices: choicesFor(store, field.id),
        })),
      });
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
      const alternative = body.alternativeKind as BenefitValueKind | null | undefined;
      if (alternative !== undefined) {
        const existing = option.fields?.find((item) => item.key === ALTERNATIVE_VALUE_KEY);
        if (alternative === null) {
          if (existing) {
            option.fields = option.fields?.filter((item) => item.id !== existing.id);
            store.values = store.values.filter((item) => item.optionFieldId !== existing.id);
          }
        } else if (existing) {
          Object.assign(existing, alternativeValueField(alternative));
        } else {
          const definition = alternativeValueField(alternative);
          option.fields = [
            ...(option.fields ?? []),
            {
              id: id('field'),
              optionId: option.id,
              label: definition.label,
              key: definition.key,
              dataType: definition.dataType,
              unit: definition.unit,
              helpText: null,
              isRequired: false,
              sortOrder: option.fields?.length ?? 0,
              ...meta(),
            },
          ];
        }
      }

      const kind = body.valueKind as BenefitValueKind | undefined;
      const field = option.fields?.find((item) => item.key !== ALTERNATIVE_VALUE_KEY);
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

      const {
        valueKind: _kind,
        alternativeKind: _alternative,
        ...rest
      } = body as Record<string, unknown>;
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
  // The field ITSELF. Anything deeper — its answers — is handled below, so
  // this must not swallow `/option-fields/:id/choices/...`.
  if (resource === 'option-fields' && first && !second) {
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
        annualPrice: prices.get(configuration.id) ?? null,
        pricedEmployeeCount: employees ? totalSmeEmployees(employees) : null,
        customerTypeLabel: plan?.customerType ?? '',
        geographicalCoverageLabel: configuration.geographicalCoverage,
        benefits: options.map((planOption) => {
          const option = store.options.find((item) => item.id === planOption.optionId);
          const value = store.values.find((v) => v.planOptionId === planOption.id)?.value ?? null;
          /**
           * The kind is the one the BUSINESS fixed for the area, as the real
           * engine reads it — a ceiling carries no percent sign, and a double
           * that made everything a percentage would let a screen print
           * "20,000%" and still pass.
           */
          const spec = medicalBenefitSpec(option?.name ?? '');
          const percentage = spec?.valueKind !== 'LIMIT';
          const figure = typeof value === 'number' ? value : null;
          return {
            optionId: planOption.optionId,
            optionName: spec?.name ?? option?.name ?? '',
            covered: figure !== null && figure !== 0,
            value: figure,
            display:
              figure === null
                ? 'Not specified in plan'
                : figure === 0
                  ? 'Not covered'
                  : percentage
                    ? `${figure}%`
                    : String(figure),
            dataType: percentage ? 'PERCENTAGE' : 'CURRENCY',
            unit: percentage ? '%' : null,
            direction: 'HIGHER_IS_BETTER',
            score: figure ? 1 : 0,
            isBest: false,
            limitations: [],
            limitationsDisplay: null,
            limitationFactor: 1,
          };
        }),
        /** The ceiling is a scored ATTRIBUTE, exactly as the engine returns it. */
        attributes: [
          {
            id: 'annualLimit',
            label: 'Annual limit',
            value: configuration.annualLimit,
            display:
              configuration.annualLimit === null
                ? 'Not specified in plan'
                : String(configuration.annualLimit),
            direction: 'HIGHER_IS_BETTER',
            score: 1,
            isBest: false,
          },
        ],
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

    /**
     * WHAT THIS CUSTOMER PAYS.
     *
     * A price lives on a BAND now, so it is read from the band spanning the
     * ages asked for — and an SME is priced by its workforce instead: every
     * occupied bracket at what the plan charges there, added up. The
     * arithmetic comes from `@aggregator/shared`, the same module the screen
     * draws its boxes from and the real API prices with.
     */
    const employees = body.smeEmployees as Record<string, number> | undefined;
    const priceOf = (configuration: PlanConfigurationDto): number | null => {
      const bands = configuration.priceBands ?? [];
      if (employees) return quoteSmeWorkforce(employees, bands).total;
      const band = bands.find(
        (row) => row.ageFrom <= Number(body.ageFrom ?? 0) && row.ageTo >= Number(body.ageTo ?? 0),
      );
      return band?.annualPrice ?? null;
    };

    const prices = new Map<string, number>();
    for (const configuration of store.configurations) {
      const price = priceOf(configuration);
      if (price !== null) prices.set(configuration.id, price);
    }

    const priced = store.configurations.filter((c) => prices.has(c.id));
    const within =
      budget === undefined ? priced : priced.filter((c) => prices.get(c.id)! <= budget);
    const above = budget === undefined ? [] : priced.filter((c) => prices.get(c.id)! > budget);
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
        smeEmployeeCount: employees ? totalSmeEmployees(employees) : null,
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

  /** Every currency the stored variants are priced in, as the real API reads it. */
  if (resource === 'comparison' && first === 'currencies' && method === 'GET') {
    return ok([...new Set(store.configurations.map((configuration) => configuration.currency))].sort());
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
      const companyId = String(body.companyId ?? '');

      const plan: PlanDto = {
        id: id('plan'),
        companyId,
        insuranceTypeId: String(body.insuranceTypeId ?? ''),
        customerType: (body.customerType ?? 'INDIVIDUAL') as PlanDto['customerType'],
        name: String(body.name ?? ''),
        code: String(body.code ?? ''),
        description: (body.description as string | null) ?? null,
        // Derived from the customer type, exactly as the real mapper does.
        averageAge: resolveAverageAgeForCustomerType(
          (body.customerType ?? 'INDIVIDUAL') as PlanDto['customerType'],
        ),
        ...meta(),
      };
      store.plans.push(plan);
      return ok(plan, 201);
    }
    const plan = store.plans.find((item) => item.id === first);
    if (!plan) return fail(404, 'NOT_FOUND', 'The record was not found.');

    /** Copy the plan with the configurations named, as the real API does. */
    if (second === 'duplicate' && method === 'POST') {
      const name = String(body.name ?? '').trim();
      if (name.toLowerCase() === plan.name.trim().toLowerCase()) {
        return fail(400, 'BAD_REQUEST', 'Give the copy a different name.', {
          name: ['This is the name of the plan being copied. Enter a different one.'],
        });
      }

      const code = (body.code as string | undefined) ?? derivePlanCode(name);
      if (store.plans.some((item) => item.companyId === plan.companyId && item.code === code)) {
        return fail(409, 'CONFLICT', `This company already has a plan with the code "${code}".`);
      }

      const copy: PlanDto = {
        ...plan,
        id: id('plan'),
        name,
        code,
        description: (body.description as string | null) ?? plan.description,
      };
      store.plans.push(copy);

      const wanted = (body.configurationIds as string[] | undefined) ?? null;
      for (const configuration of store.configurations.filter(
        (item) => item.planId === plan.id && (wanted === null || wanted.includes(item.id)),
      )) {
        const copiedConfiguration: PlanConfigurationDto = {
          ...configuration,
          id: id('configuration'),
          planId: copy.id,
        };
        store.configurations.push(copiedConfiguration);

        for (const planOption of store.planOptions.filter(
          (item) => item.planConfigurationId === configuration.id,
        )) {
          const copiedOption: StoredPlanOption = {
            ...planOption,
            id: id('planOption'),
            planConfigurationId: copiedConfiguration.id,
          };
          store.planOptions.push(copiedOption);
          for (const value of store.values.filter((item) => item.planOptionId === planOption.id)) {
            store.values.push({ ...value, planOptionId: copiedOption.id });
          }
        }
      }

      return ok(
        {
          ...copy,
          configurations: store.configurations
            .filter((item) => item.planId === copy.id)
            .map((item) => hydrateConfiguration(store, item)),
        },
        201,
      );
    }
    if (method === 'GET') {
      return ok({
        ...networkName(store, plan),
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
      /**
       * Every band has to run forwards and be named once, as the real API says.
       * The variant itself carries no age at all — the bands underneath do.
       */
      const bands = (body.priceBands ?? []) as { ageFrom: number; ageTo: number }[];
      const backwards = bands.find((band) => band.ageFrom > band.ageTo);
      if (backwards) {
        return fail(422, 'VALIDATION_ERROR', 'The request payload is invalid.', {
          priceBands: [`Ages ${backwards.ageFrom}-${backwards.ageTo} run backwards.`],
        });
      }
      const seen = new Set<string>();
      for (const band of bands) {
        const key = `${band.ageFrom}-${band.ageTo}`;
        if (seen.has(key)) {
          return fail(409, 'DUPLICATE', `This variant lists ages ${key} twice.`);
        }
        seen.add(key);
      }

      const networkId = (body.medicalNetworkId as string | null | undefined) ?? null;
      const room = (body.roomType as string | null | undefined) ?? null;
      const limit = (body.annualLimit as number | null | undefined) ?? null;

      // A variant is sold on one of ITS OWN company's networks, never another's.
      const owner = store.plans.find((item) => item.id === body.planId);
      if (owner) {
        const foreign = foreignNetwork(store, owner.companyId, networkId);
        if (foreign) return foreign;
      }

      const duplicate = store.configurations.some(
        (configuration) =>
          configuration.planId === body.planId &&
          configuration.geographicalCoverage === body.geographicalCoverage &&
          configuration.medicalNetworkId === networkId &&
          configuration.roomType === room &&
          configuration.annualLimit === limit,
      );
      if (duplicate) {
        return fail(409, 'DUPLICATE', 'This plan already has that variant.');
      }
      const configuration: PlanConfigurationDto = {
        id: id('configuration'),
        planId: String(body.planId ?? ''),
        geographicalCoverage:
          body.geographicalCoverage as PlanConfigurationDto['geographicalCoverage'],
        medicalNetworkId: networkId,
        roomType: room,
        // The whole rate table arrives with the variant, never band by band.
        priceBands: ((body.priceBands ?? []) as PlanPriceBandDto[]).map((band) => ({
          ...band,
          id: id('band'),
          annualPrice: band.annualPrice ?? null,
        })),
        currency: (body.currency as string | null) ?? null,
        annualLimit: (body.annualLimit as number | null) ?? null,
        deductible: (body.deductible as number | null) ?? null,
        coPayment: (body.coPayment as number | null) ?? null,
        ...meta(),
      };
      store.configurations.push(configuration);
      return ok(networkName(store, configuration), 201);
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
          note: planOption.note ?? null,
          tickedChoiceIds: [...(planOption.tickedChoiceIds ?? [])],
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

  // --- the answers ONE SETTING offers --------------------------------------
  if (resource === 'option-fields' && second === 'choices') {
    if (method === 'GET') return ok(choicesFor(store, first!));

    /** Ordering IS the weighting, so it is written through its own route. */
    if (method === 'POST' && third === 'reorder') {
      (body.orderedIds as unknown as string[]).forEach((choiceId, index) => {
        const target = store.choices.find((choice) => choice.id === choiceId);
        if (target) target.sortOrder = index;
      });
      return noContent();
    }

    if (method === 'POST') {
      const created: OptionChoiceDto = {
        id: id('choice'),
        optionFieldId: first!,
        label: String(body.label),
        // The END of the list: an unranked answer is an unknown, and landing it
        // at the mild end would flatter every plan that carries it.
        sortOrder: choicesFor(store, first!).length,
        rankCount: choicesFor(store, first!).length + 1,
        ...meta(),
      };
      store.choices.push(created);
      return ok(created, 201);
    }

    if (method === 'PATCH' && third) {
      const target = store.choices.find((choice) => choice.id === third);
      if (!target) return fail(404, 'NOT_FOUND', 'The record was not found.');
      if (body.label !== undefined) target.label = String(body.label);
      return ok(target);
    }

    if (method === 'DELETE' && third) {
      const used = store.planOptions.filter((planOption) =>
        (planOption.tickedChoiceIds ?? []).includes(third),
      );
      if (used.length > 0 && search.get('force') !== 'true') {
        return fail(
          409,
          'CONFLICT',
          `"` + third + `" is recorded on ` + used.length + ' plan benefits.',
        );
      }
      for (const planOption of used) {
        planOption.tickedChoiceIds = (planOption.tickedChoiceIds ?? []).filter((x) => x !== third);
      }
      store.choices = store.choices.filter((choice) => choice.id !== third);
      return noContent();
    }
  }

  // --- plan options --------------------------------------------------------
  if (resource === 'plan-options') {
    const planOption = store.planOptions.find((item) => item.id === first);
    if (!planOption) return fail(404, 'NOT_FOUND', 'The record was not found.');
    /** One value, named by its field: the others are left alone. */
    if (second === 'values' && third && method === 'PUT') {
      const existing = store.values.find(
        (item) => item.planOptionId === planOption.id && item.optionFieldId === third,
      );
      const value = body.value as number | string | boolean | null;
      if (existing) existing.value = value;
      else store.values.push({ planOptionId: planOption.id, optionFieldId: third, value });
      return ok(hydratePlanOption(store, planOption));
    }
    /**
     * A complete replace for ONE setting: answers ticked on the others are left
     * exactly as they are.
     */
    if (second === 'settings' && fourth === 'choices' && method === 'PUT') {
      const forThisField = new Set(
        store.choices.filter((choice) => choice.optionFieldId === third).map((choice) => choice.id),
      );
      const kept = (planOption.tickedChoiceIds ?? []).filter((cid) => !forThisField.has(cid));
      planOption.tickedChoiceIds = [...kept, ...((body.choiceIds as unknown as string[]) ?? [])];
      return ok(hydratePlanOption(store, planOption));
    }
    /**
     * A ROW IS THE TOGGLE: switching a condition on creates a row with no value
     * yet, and switching it off removes the row and the inputs it owns. There
     * is no enabled column, so nothing can disagree with anything else.
     */
    if (second === 'conditions' && third && method === 'PUT') {
      const option = store.options.find((item) => item.id === planOption.optionId);
      const field = (option?.fields ?? []).find((item) => item.id === third);
      if (!field) return fail(400, 'BAD_REQUEST', 'That setting does not belong to this benefit.');
      if (!field.isOptional) {
        return fail(400, 'BAD_REQUEST', `"${field.label}" is a core field and is always shown.`);
      }

      const owned = new Set([
        third,
        ...(option?.fields ?? []).filter((item) => item.parentFieldId === third).map((i) => i.id),
      ]);

      if (body.enabled as unknown as boolean) {
        const already = store.values.some(
          (value) => value.planOptionId === planOption.id && value.optionFieldId === third,
        );
        // Created with a null value: the condition applies, the figure may not
        // have been stated. That is not zero.
        if (!already)
          store.values.push({ planOptionId: planOption.id, optionFieldId: third, value: null });
      } else {
        store.values = store.values.filter(
          (value) => !(value.planOptionId === planOption.id && owned.has(value.optionFieldId)),
        );
        planOption.tickedChoiceIds = (planOption.tickedChoiceIds ?? []).filter(
          (cid) => !store.choices.some((c) => c.id === cid && owned.has(c.optionFieldId)),
        );
      }
      return ok(hydratePlanOption(store, planOption));
    }
    if (second === 'note' && method === 'PATCH') {
      const note = body.note as string | null;
      planOption.note = note === null || String(note).trim() === '' ? null : String(note).trim();
      return ok(hydratePlanOption(store, planOption));
    }
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
    // A variant always carries a rate table, even an empty one.
    priceBands: configuration.priceBands ?? [],
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

  /**
   * A condition's own inputs are NESTED under it as `subValues`, exactly as the
   * real mapper nests them — listed beside it they would render as core fields
   * of their own, visible before the condition they belong to is switched on.
   */
  const inputsByParent = new Map<string, typeof fields>();
  for (const field of fields) {
    if (!field.parentFieldId) continue;
    inputsByParent.set(field.parentFieldId, [
      ...(inputsByParent.get(field.parentFieldId) ?? []),
      field,
    ]);
  }

  const toValue = (field: (typeof fields)[number]): PlanOptionValueDto => {
    const stored = store.values.find(
      (value) => value.planOptionId === planOption.id && value.optionFieldId === field.id,
    );
    const value = stored?.value ?? null;
    const planOptionHasValue = stored !== undefined;
    const offersChoices =
      field.dataType === 'RANK' || field.dataType === 'MULTI' || field.dataType === 'TEXT';
    // The answers belong to THIS setting, ranked within it.
    const choices = choicesFor(store, field.id);

    return {
      id: stored ? `${planOption.id}:${field.id}` : '',
      optionFieldId: field.id,
      fieldKey: field.key,
      fieldLabel: field.label,
      dataType: field.dataType,
      unit: field.unit,
      value,
      /**
       * Defaults the real API always supplies. A fixture that predates a
       * column should read as the column's neutral value — a core field,
       * revealed by nothing, applying to every customer type — rather than
       * as undefined, which would crash the screen rendering it.
       */
      isOptional: field.isOptional ?? false,
      isRequired: field.isRequired ?? false,
      isEnabled: field.isOptional ? planOptionHasValue : true,
      showWhenChoiceId: field.showWhenChoiceId ?? null,
      customerTypes: field.customerTypes ?? [],
      ...(offersChoices ? { choices } : {}),
      ...(field.dataType === 'RANK'
        ? { choiceLabel: choices.find((choice) => choice.id === value)?.label ?? null }
        : {}),
      ...(field.dataType === 'MULTI'
        ? {
            selectedChoiceIds: (planOption.tickedChoiceIds ?? []).filter((cid) =>
              choices.some((choice) => choice.id === cid),
            ),
          }
        : {}),
      ...(inputsByParent.has(field.id)
        ? { subValues: (inputsByParent.get(field.id) ?? []).map(toValue) }
        : {}),
    };
  };

  return {
    id: planOption.id,
    planConfigurationId: planOption.planConfigurationId,
    optionId: planOption.optionId,
    optionName: option?.name ?? 'Unknown',
    isUmbrella: option?.isUmbrella ?? false,
    parentOptionId: option?.parentId ?? null,
    note: planOption.note ?? null,
    sortOrder: planOption.sortOrder,
    createdAt: now(),
    updatedAt: now(),
    values: fields.filter((field) => !field.parentFieldId).map(toValue),
  };
}

/** One SETTING's answers, in rank order, each knowing how long the list is. */
function choicesFor(store: FakeStore, optionFieldId: string): OptionChoiceDto[] {
  const answers = store.choices
    .filter((choice) => choice.optionFieldId === optionFieldId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return answers.map((choice) => ({ ...choice, rankCount: answers.length }));
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
