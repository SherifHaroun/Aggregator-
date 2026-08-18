/**
 * Employee data-management interface.
 *
 * Every test starts from an EMPTY store and works through the real UI against a
 * fake API that speaks the real contract. No record here reaches any database —
 * this is test scaffolding, not seed data.
 *
 * The company, plan and benefit names below are invented inside the tests on
 * purpose: they prove the interface works for anything an employee creates, and
 * the application code never mentions them.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/config/routes';
import { createStore, installFakeApi, type FakeStore } from './fake-api';
import { renderApp } from './render';

let store: FakeStore;
const originalFetch = globalThis.fetch;
const timestamps = { createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };

beforeEach(() => {
  store = installFakeApi(createStore());
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// --- fixtures ---------------------------------------------------------------

function givenCompany(id = 'company_1', name = 'Northwind Assurance') {
  store.companies.push({
    id,
    name,
    shortName: null,
    logoUrl: null,
    description: null,
    website: null,
    email: null,
    phone: null,
    mobile: null,
    address: null,
    isActive: true,
    ...timestamps,
  });
  return id;
}

function givenInsuranceType(id = 'type_1', name = 'Test Insurance Type') {
  store.insuranceTypes.push({
    id,
    name,
    code: name.toLowerCase().replace(/\W+/g, '_'),
    description: null,
    sortOrder: 0,
    isActive: true,
    ...timestamps,
  });
  return id;
}

function givenPlan(id = 'plan_1', companyId = 'company_1', typeId = 'type_1') {
  store.plans.push({
    id,
    companyId,
    insuranceTypeId: typeId,
    name: 'Tier One',
    code: 'TIER-ONE',
    description: null,
    category: null,
    isActive: true,
    ...timestamps,
  });
  return id;
}

/** A benefit invented here, with a field shape the code never anticipates. */
function givenOption(id = 'option_1', name = 'Aurora Wellness Programme', typeId = 'type_1') {
  store.options.push({
    id,
    insuranceTypeId: typeId,
    name,
    description: null,
    sortOrder: 0,
    isActive: true,
    ...timestamps,
    fields: [
      { id: `${id}_coverage`, optionId: id, label: 'Coverage Percentage', key: 'coverage_percentage', dataType: 'PERCENTAGE', unit: null, helpText: null, isRequired: false, sortOrder: 0, isActive: true, ...timestamps },
      { id: `${id}_limit`, optionId: id, label: 'Annual Limit', key: 'annual_limit', dataType: 'CURRENCY', unit: null, helpText: null, isRequired: false, sortOrder: 1, isActive: true, ...timestamps },
      { id: `${id}_sessions`, optionId: id, label: 'Maximum Sessions', key: 'maximum_sessions', dataType: 'NUMBER', unit: null, helpText: null, isRequired: false, sortOrder: 2, isActive: true, ...timestamps },
    ],
  });
  return id;
}

function givenConfiguration(
  id: string,
  planId: string,
  customerType: 'INDIVIDUAL' | 'FAMILY' | 'SME' = 'INDIVIDUAL',
) {
  store.configurations.push({
    id,
    planId,
    customerType,
    geographicalCoverage: 'LOCAL',
    currency: 'EGP',
    annualPrice: 7500,
    annualLimit: null,
    deductible: null,
    coPayment: null,
    averageAge: { value: null, source: 'NOT_SPECIFIED', label: null },
    isActive: true,
    ...timestamps,
  });
  return id;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('navigation', () => {
  it('offers exactly Dashboard, Add Company and Companies', async () => {
    renderApp(ROUTES.dashboard);
    const sidebar = await screen.findByRole('navigation');
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim());

    expect(links).toEqual(['Dashboard', 'Add Company', 'Companies']);
  });

  it('has no top-level entry for insurance types, plans or options', async () => {
    renderApp(ROUTES.dashboard);
    const sidebar = await screen.findByRole('navigation');
    for (const gone of [/insurance types/i, /^plans$/i, /insurance options/i, /configurations/i]) {
      expect(within(sidebar).queryByText(gone)).not.toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

describe('empty states', () => {
  it('invites the employee to add the first company', async () => {
    renderApp(ROUTES.companies.list);
    expect(await screen.findByText('No insurance companies yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(store.companies).toHaveLength(0);
  });

  it('shows an empty dashboard rather than invented figures', async () => {
    renderApp(ROUTES.dashboard);
    expect(await screen.findByText('The insurance database is empty')).toBeInTheDocument();
  });

  /**
   * A failed request must never read as "no data". The dashboard used to sum
   * `data?.length ?? 0`, so an unreachable API produced four zeroes and the
   * headline "The insurance database is empty" — indistinguishable from real
   * data loss.
   */
  it('never claims the database is empty when the request failed', async () => {
    // Every dashboard query fails, as during the API's boot window.
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'API_UNREACHABLE', message: 'The API server is not running.' },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    renderApp(ROUTES.dashboard);

    expect(await screen.findByText('Could not load the overview')).toBeInTheDocument();
    expect(screen.getByText(/cannot reach the server/i)).toBeInTheDocument();
    expect(screen.queryByText('The insurance database is empty')).not.toBeInTheDocument();
    // Counts read as unknown rather than a misleading zero.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('prompts for the first plan on a new company', async () => {
    givenCompany();
    renderApp(ROUTES.companies.detail('company_1'));
    expect(await screen.findByText('No plans yet')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Add company -> setup handoff
// ---------------------------------------------------------------------------

describe('adding a company', () => {
  it('asks for the company name and nothing else', async () => {
    renderApp(ROUTES.companies.new);
    expect(await screen.findByLabelText(/Company name/i)).toBeInTheDocument();

    for (const absent of [
      /logo/i,
      /description/i,
      /website/i,
      /^email/i,
      /phone/i,
      /mobile/i,
      /address/i,
    ]) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }
    // One field, one button.
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('creates the company and continues straight into plan setup', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.companies.new);

    await user.type(await screen.findByLabelText(/Company name/i), 'Northwind Assurance');
    await user.click(screen.getByRole('button', { name: /Create company/i }));

    await waitFor(() => expect(store.companies).toHaveLength(1));
    expect(store.companies[0]).toMatchObject({ name: 'Northwind Assurance', isActive: true });

    // It lands on the company's own setup step, not back on a list.
    expect(
      await screen.findByText(/Set up plans for Northwind Assurance/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();
  });

  it('shows the API validation message on the offending field', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.companies.new);

    await user.click(await screen.findByRole('button', { name: /Create company/i }));

    expect(await screen.findByText(/Please correct the highlighted fields/i)).toBeInTheDocument();
    expect(await screen.findByText(/String must contain at least 1 character/i)).toBeInTheDocument();
    expect(store.companies).toHaveLength(0);
  });

  it('explains a server failure in plain language', async () => {
    store.failNext = {
      method: 'GET',
      path: /^\/companies/,
      status: 503,
      body: {
        ok: false,
        error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not reachable.' },
      },
    };

    renderApp(ROUTES.companies.list);

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/database is not available right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/Prisma/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Editing from Companies
// ---------------------------------------------------------------------------

describe('editing a company', () => {
  it('opens the company from the Companies list and renames it', async () => {
    const user = userEvent.setup();
    givenCompany('company_1', 'Original Name');

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click(await screen.findByRole('button', { name: /Edit company/i }));

    const nameInput = await screen.findByLabelText(/Company name/i);
    await waitFor(() => expect(nameInput).toHaveValue('Original Name'));

    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Company');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(store.companies[0]?.name).toBe('Renamed Company'));
  });
});

// ---------------------------------------------------------------------------
// Plans, created inside the company
// ---------------------------------------------------------------------------

describe('plans', () => {
  it('creates a plan and a brand-new insurance type inline', async () => {
    const user = userEvent.setup();
    givenCompany();

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    // Scope to the dialog: a real <dialog> makes the page behind it inert, but
    // jsdom keeps the trigger button queryable.
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Plan name/i), 'Tier One');
    // No sidebar page for insurance types — one is created from this form.
    await user.selectOptions(dialog.getByLabelText(/Insurance type/i), '__new__');
    await user.type(await dialog.findByLabelText(/New insurance type name/i), 'Household Cover');
    await user.click(dialog.getByRole('button', { name: /Add plan/i }));

    await waitFor(() => expect(store.plans).toHaveLength(1));
    expect(store.insuranceTypes).toHaveLength(1);
    expect(store.insuranceTypes[0]?.name).toBe('Household Cover');
    // The code is derived so the employee never has to invent one.
    expect(store.plans[0]).toMatchObject({
      name: 'Tier One',
      code: 'TIER-ONE',
      insuranceTypeId: store.insuranceTypes[0]?.id,
    });
  });

  it('stores the price on the configuration, never on the plan', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Plan name/i), 'Tier One');
    await user.selectOptions(dialog.getByLabelText(/Insurance type/i), 'type_1');
    await user.type(dialog.getByLabelText(/Currency/i), 'EGP');
    await user.type(dialog.getByLabelText(/Annual price/i), '7500');
    await user.click(dialog.getByRole('button', { name: /Add plan/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));

    // The product carries no pricing; its configuration does.
    expect(store.plans[0]).not.toHaveProperty('annualPrice');
    expect(store.configurations[0]).toMatchObject({
      planId: store.plans[0]?.id,
      customerType: 'INDIVIDUAL',
      geographicalCoverage: 'LOCAL',
      annualPrice: 7500,
    });
  });
});

// ---------------------------------------------------------------------------
// Configurations
// ---------------------------------------------------------------------------

describe('plan configurations', () => {
  it('offers exactly Individual, Family and SME — no Couple', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add configuration/i }))[0]!);

    const group = await screen.findByRole('group', { name: /Who is this for/i });
    const labels = within(group)
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent ?? '');

    expect(labels.some((l) => l.includes('Individual'))).toBe(true);
    expect(labels.some((l) => l.includes('Family'))).toBe(true);
    expect(labels.some((l) => l.includes('SME'))).toBe(true);
    expect(labels.some((l) => /couple/i.test(l))).toBe(false);
  });

  it('offers Local and International only', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add configuration/i }))[0]!);

    const group = await screen.findByRole('group', { name: /Geographical coverage/i });
    const labels = within(group)
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent ?? '');

    expect(labels).toHaveLength(2);
    expect(labels.some((l) => l.includes('Local'))).toBe(true);
    expect(labels.some((l) => l.includes('International'))).toBe(true);
    expect(labels.some((l) => /egypt only|worldwide/i.test(l))).toBe(false);
  });

  it('shows the fixed SME average age instead of an age input', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add configuration/i }))[0]!);

    const group = await screen.findByRole('group', { name: /Who is this for/i });
    const sme = within(group)
      .getAllByRole('radio')
      .find((radio) => (radio.closest('label')?.textContent ?? '').includes('SME'))!;
    await user.click(sme);

    expect(await screen.findByText('Average age: 35')).toBeInTheDocument();
    expect(screen.queryByLabelText(/average age/i)).not.toBeInTheDocument();
  });

  it('creates a configuration with its own price', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add configuration/i }))[0]!);

    const who = await screen.findByRole('group', { name: /Who is this for/i });
    await user.click(within(who).getAllByRole('radio')[0]!);
    const where = screen.getByRole('group', { name: /Geographical coverage/i });
    await user.click(within(where).getAllByRole('radio')[0]!);

    await user.type(screen.getByLabelText(/Currency/i), 'EGP');
    await user.type(screen.getByLabelText(/Annual price/i), '7500');
    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));
    expect(store.configurations[0]).toMatchObject({
      customerType: 'INDIVIDUAL',
      geographicalCoverage: 'LOCAL',
      annualPrice: 7500,
    });
  });
});

// ---------------------------------------------------------------------------
// Dynamic benefits
// ---------------------------------------------------------------------------

describe('dynamic insurance options', () => {
  it('creates a benefit with employee-defined fields, no code knowing their names', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: /New benefit/i }));
    await user.type(await screen.findByLabelText(/Benefit name/i), 'Aurora Wellness Programme');

    for (const [label, type] of [
      ['Coverage Percentage', 'Percentage'],
      ['Annual Limit', 'Amount'],
      ['Maximum Sessions', 'Number'],
    ] as const) {
      await user.type(screen.getByLabelText(/New field/i), label);
      await user.selectOptions(screen.getByLabelText(/^Type$/i), type);
      await user.click(screen.getByRole('button', { name: /^Add$/ }));
    }

    await user.click(screen.getByRole('button', { name: /Create benefit/i }));

    await waitFor(() => expect(store.options).toHaveLength(1));
    expect(store.options[0]?.name).toBe('Aurora Wellness Programme');
    expect(store.options[0]?.fields?.map((f) => f.label)).toEqual([
      'Coverage Percentage',
      'Annual Limit',
      'Maximum Sessions',
    ]);
  });

  it('renders inputs generated from each benefit’s own field definitions', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    expect(await screen.findByLabelText('Coverage Percentage')).toBeInTheDocument();
    expect(screen.getByLabelText('Annual Limit')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum Sessions')).toBeInTheDocument();
  });

  it('renders a different benefit with a completely different field shape', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    store.options.push({
      id: 'option_2',
      insuranceTypeId: 'type_1',
      name: 'Zenith Travel Assistance',
      description: null,
      sortOrder: 0,
      isActive: true,
      ...timestamps,
      fields: [
        { id: 'f_available', optionId: 'option_2', label: 'Available', key: 'available', dataType: 'BOOLEAN', unit: null, helpText: null, isRequired: false, sortOrder: 0, isActive: true, ...timestamps },
        { id: 'f_provider', optionId: 'option_2', label: 'Provider', key: 'provider', dataType: 'TEXT', unit: null, helpText: null, isRequired: false, sortOrder: 1, isActive: true, ...timestamps },
      ],
    });
    store.planOptions.push({
      id: 'planOption_2',
      planConfigurationId: configurationId,
      optionId: 'option_2',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    // Boolean renders as a Yes/No select, text as a text box — driven by dataType.
    const available = await screen.findByLabelText('Available');
    expect(available.tagName).toBe('SELECT');
    expect(screen.getByLabelText('Provider').tagName).toBe('INPUT');

    await user.selectOptions(available, 'true');
    await user.type(screen.getByLabelText('Provider'), 'Any network clinic');
    await user.click(screen.getByRole('button', { name: 'Save Zenith Travel Assistance' }));

    await waitFor(() => expect(store.values).toHaveLength(2));
    expect(store.values.find((v) => v.optionFieldId === 'f_available')?.value).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Drag and drop, values, isolation
// ---------------------------------------------------------------------------

describe('plan coverage', () => {
  it('adds a benefit from the available panel', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    expect(await screen.findByText('Aurora Wellness Programme')).toBeInTheDocument();

    // fireEvent rather than user.click: userEvent's pointer emulation does not
    // reach buttons inside a dnd-kit draggable under jsdom, which has no layout.
    // The real pointer path is verified in a browser instead.
    fireEvent.click(screen.getByRole('button', { name: 'Add Aurora Wellness Programme' }));

    expect(await screen.findByLabelText('Coverage Percentage')).toBeInTheDocument();
    expect(store.planOptions).toHaveLength(1);
  });

  it('exposes drag handles on both panels and persists a new order', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption('option_1', 'Aurora Wellness Programme');
    givenOption('option_2', 'Zenith Travel Assistance');
    store.planOptions.push(
      { id: 'planOption_a', planConfigurationId: configurationId, optionId: 'option_1', sortOrder: 0 },
      { id: 'planOption_b', planConfigurationId: configurationId, optionId: 'option_2', sortOrder: 1 },
    );

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    expect(
      await screen.findByRole('button', { name: /Reorder Aurora Wellness Programme/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Reorder Zenith Travel Assistance/i }),
    ).toBeInTheDocument();

    // jsdom reports zero-sized rects, so dnd-kit cannot resolve a pointer drop
    // target. The endpoint the board calls on drop is exercised directly.
    await fetch(`/api/v1/plan-configurations/${configurationId}/options/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedIds: ['planOption_b', 'planOption_a'] }),
    });

    expect(store.planOptions.find((p) => p.id === 'planOption_b')?.sortOrder).toBe(0);
    expect(store.planOptions.find((p) => p.id === 'planOption_a')?.sortOrder).toBe(1);
  });

  it('keeps each configuration’s values separate', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    givenOption();
    const individual = givenConfiguration('cfg_individual', 'plan_1', 'INDIVIDUAL');
    const family = givenConfiguration('cfg_family', 'plan_1', 'FAMILY');

    store.planOptions.push(
      { id: 'po_individual', planConfigurationId: individual, optionId: 'option_1', sortOrder: 0 },
      { id: 'po_family', planConfigurationId: family, optionId: 'option_1', sortOrder: 0 },
    );

    const first = renderApp(ROUTES.configurations.detail('company_1', 'plan_1', individual));
    await user.type(await screen.findByLabelText('Coverage Percentage'), '80');
    await user.click(screen.getByRole('button', { name: 'Save Aurora Wellness Programme' }));
    await waitFor(() => expect(store.values).toHaveLength(3));
    first.unmount();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', family));
    await user.type(await screen.findByLabelText('Coverage Percentage'), '90');
    await user.click(screen.getByRole('button', { name: 'Save Aurora Wellness Programme' }));
    await waitFor(() => expect(store.values).toHaveLength(6));

    const coverageFor = (planOptionId: string) =>
      store.values.find(
        (v) => v.planOptionId === planOptionId && v.optionFieldId === 'option_1_coverage',
      )?.value;

    expect(coverageFor('po_individual')).toBe(80);
    expect(coverageFor('po_family')).toBe(90);
  });
});
