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
  resolveAverageAgeForCustomerType,
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
  /** Set to make the next matching request fail, e.g. to test error states. */
  failNext: { method: string; path: RegExp; status: number; body: unknown } | null;
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
  new Response(JSON.stringify({ ok: false, error: { code, message, ...(details ? { details } : {}) } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

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
      const { status, body: failBody } = store.failNext;
      store.failNext = null;
      return new Response(JSON.stringify(failBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return route({ store, path, method, body, search: url.searchParams }) ?? fail(404, 'NOT_FOUND', 'No route');
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
        code: String(body.name ?? '').toLowerCase().replace(/\W+/g, '_'),
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
    if (method === 'GET' && !first) {
      const typeFilter = search.get('insuranceTypeId');
      return ok(
        page(
          store.options.filter(
            (option) => !typeFilter || option.insuranceTypeId === typeFilter,
          ),
        ),
      );
    }
    if (method === 'POST' && !first) {
      const optionId = id('option');
      // The real API accepts the option's fields in the same request.
      const inlineFields = (body.fields ?? []) as unknown as {
        label: string;
        dataType: OptionFieldDto['dataType'];
      }[];
      const option: InsuranceOptionDto = {
        id: optionId,
        insuranceTypeId: String(body.insuranceTypeId ?? ''),
        name: String(body.name ?? ''),
        description: (body.description as string | null) ?? null,
        sortOrder: store.options.length,
        fields: inlineFields.map((field, index) => ({
          id: id('field'),
          optionId,
          label: field.label,
          key: field.label.toLowerCase().replace(/\W+/g, '_'),
          dataType: field.dataType,
          unit: null,
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
    if (method === 'PATCH') {
      Object.assign(option, body);
      return ok(option);
    }
    if (second === 'fields' && method === 'POST') {
      const field: OptionFieldDto = {
        id: id('field'),
        optionId: option.id,
        label: String(body.label ?? ''),
        key: String(body.label ?? '').toLowerCase().replace(/\W+/g, '_'),
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
        category: (body.category as string | null) ?? null,
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
      const duplicate = store.configurations.some(
        (configuration) =>
          configuration.planId === body.planId &&
          configuration.customerType === body.customerType &&
          configuration.geographicalCoverage === body.geographicalCoverage,
      );
      if (duplicate) {
        return fail(409, 'DUPLICATE', 'A record with this planId, customerType already exists.');
      }
      const configuration: PlanConfigurationDto = {
        id: id('configuration'),
        planId: String(body.planId ?? ''),
        customerType: body.customerType as PlanConfigurationDto['customerType'],
        geographicalCoverage: body.geographicalCoverage as PlanConfigurationDto['geographicalCoverage'],
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
      const planOption: StoredPlanOption = {
        id: id('planOption'),
        planConfigurationId: configuration.id,
        optionId: String(body.optionId ?? ''),
        sortOrder: store.planOptions.filter((item) => item.planConfigurationId === configuration.id)
          .length,
      };
      store.planOptions.push(planOption);
      return ok(hydratePlanOption(store, planOption), 201);
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
