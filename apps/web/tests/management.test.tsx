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

/** A benefit invented here: a name, and the percentage every benefit carries. */
function givenOption(id = 'option_1', name = 'Aurora Wellness Programme') {
  store.options.push({
    id,
    name,
    description: null,
    sortOrder: 0,
    isActive: true,
    ...timestamps,
    fields: [
      { id: `${id}_percentage`, optionId: id, label: 'Percentage', key: 'percentage', dataType: 'PERCENTAGE', unit: '%', helpText: null, isRequired: false, sortOrder: 0, isActive: true, ...timestamps },
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
    ageFrom: 18,
    ageTo: 60,
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
  it('offers exactly Dashboard, Compare plans, Add Company and Companies', async () => {
    renderApp(ROUTES.dashboard);
    const sidebar = await screen.findByRole('navigation');
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim());

    expect(links).toEqual(['Dashboard', 'Compare plans', 'Add Company', 'Companies']);
  });

  it('leads with starting a comparison, not with managing companies', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.dashboard);

    // The headline is the action, and it is the page's first heading.
    expect(await screen.findByRole('heading', { name: 'Start Comparing', level: 1 })).toBeInTheDocument();

    // The company list is no longer the dashboard's content — the company's
    // own name must not appear on it.
    expect(screen.queryByText('Northwind Assurance')).not.toBeInTheDocument();

    // The primary action reaches the real comparison flow.
    await user.click(screen.getByRole('link', { name: /Start Comparing/i }));
    expect(
      await screen.findByRole('heading', { name: 'Insurance plan', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: /Who do you want to insure/i })).toBeInTheDocument();
  });

  it('asks for one age and a budget, and never for benefits', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    givenConfiguration('cfg_1', 'plan_1');
    givenOption();

    renderApp(ROUTES.comparison.new);

    expect(await screen.findByRole('heading', { name: 'Insurance plan', level: 1 })).toBeInTheDocument();

    // ONE age, not a range, and no slider anywhere.
    expect(screen.getByLabelText(/^Age/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Age from/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Age to/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(0);

    // The customer states requirements; the system finds the benefits.
    expect(screen.queryByText(/Which benefits matter to you/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Aurora Wellness Programme')).not.toBeInTheDocument();

    // An individual types their own age.
    await user.click(screen.getByRole('radio', { name: /Individual/i }));
    await user.type(screen.getByLabelText(/^Age/), '52');
    expect(screen.getByLabelText(/^Age/)).toHaveValue(52);

    // SME is quoted against the standard age, so the field is filled in and
    // LOCKED — the figure is a business rule, not a preference.
    await user.click(screen.getByRole('radio', { name: /SME/i }));
    await waitFor(() => expect(screen.getByLabelText(/^Age/)).toHaveValue(35));

    const age = screen.getByLabelText(/^Age/);
    expect(age).toHaveAttribute('readonly');
    await user.type(age, '9');
    expect(age).toHaveValue(35);

    // Switching back hands the customer their own figure again.
    await user.click(screen.getByRole('radio', { name: /Individual/i }));
    await waitFor(() => expect(screen.getByLabelText(/^Age/)).toHaveValue(52));
  });

  it('adds an insurance type from the insurance types screen', async () => {
    const user = userEvent.setup();
    givenInsuranceType('type_1', 'Medical');

    renderApp(ROUTES.insuranceTypes.list);
    expect(await screen.findByRole('heading', { name: 'Insurance types', level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add insurance type/i }));

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/^Name/), 'Motor');
    await user.click(dialog.getByRole('button', { name: /Add type/i }));

    await waitFor(() => expect(store.insuranceTypes).toHaveLength(2));
    expect(store.insuranceTypes[1]?.name).toBe('Motor');
    // The new category appears in the list it was added from.
    await waitFor(() => expect(screen.getAllByText('Motor').length).toBeGreaterThan(0));
  });

  it('asks a family for a youngest and an eldest, and validates the order', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.comparison.new);
    await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });

    // An individual is one age.
    await user.click(screen.getByRole('radio', { name: /Individual/i }));
    expect(screen.getByLabelText(/^Age/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Age to/i)).not.toBeInTheDocument();

    // A family covers a group, so it needs both ends of the range.
    await user.click(screen.getByRole('radio', { name: /Family/i }));
    expect(await screen.findByLabelText(/^Age from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Age to/i)).toBeInTheDocument();

    // Still no slider, and still no range for a single person.
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(0);

    // A backwards range is refused.
    await user.type(screen.getByLabelText(/^Age from/i), '50');
    await user.type(screen.getByLabelText(/^Age to/i), '30');
    await user.click(screen.getByRole('button', { name: /Compare Plans/i }));
    expect(
      await screen.findByText('Age From cannot be greater than Age To.'),
    ).toBeInTheDocument();
  });

  it('offers a worked-out budget or a typed one, and asks for it last', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.comparison.new);
    await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });

    // Two ways to set it, and no slider.
    const modes = await screen.findAllByRole('radio', { name: /Work it out for me|Enter an amount/i });
    expect(modes).toHaveLength(2);
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(0);

    // It sits after every question it is worked out from.
    const budgetHeading = screen.getByText('Annual budget');
    const currencyLabel = screen.getByText('Currency');
    expect(
      currencyLabel.compareDocumentPosition(budgetHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Working it out is the default, so no amount is asked for.
    expect(screen.queryByLabelText(/^Amount/)).not.toBeInTheDocument();

    // Choosing to type one reveals the field.
    await user.click(screen.getByRole('radio', { name: /Enter an amount/i }));
    expect(await screen.findByLabelText(/^Amount/)).toBeInTheDocument();
  });

  it('lists the plans above the budget underneath, with their own best pick', async () => {
    givenCompany('company_1', 'Northwind Assurance');
    givenCompany('company_2', 'Southwind Mutual');
    givenInsuranceType();
    givenPlan('plan_1', 'company_1');
    givenPlan('plan_2', 'company_2');
    const cheap = givenConfiguration('cfg_cheap', 'plan_1');
    const dear = givenConfiguration('cfg_dear', 'plan_2');
    store.configurations.find((c) => c.id === cheap)!.annualPrice = 600;
    store.configurations.find((c) => c.id === dear)!.annualPrice = 1500;

    const params = new URLSearchParams({
      insuranceTypeId: 'type_1',
      customerTypeId: 'INDIVIDUAL',
      geographicalCoverageId: 'LOCAL',
      currency: 'EGP',
      ageFrom: '35',
      ageTo: '35',
      budget: '700',
    });
    renderApp(`${ROUTES.comparison.results}?${params.toString()}`);

    // The affordable plan leads.
    expect(await screen.findByText('RECOMMENDED')).toBeInTheDocument();

    // The dearer one is not hidden — it is shown beneath, with its own pick.
    expect(
      await screen.findByRole('heading', { name: 'Above your budget' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('BEST ABOVE YOUR BUDGET')).toBeInTheDocument();
    expect(screen.getByText(/1 plan costs more than 700 EGP/)).toBeInTheDocument();
    expect(screen.getAllByText('Southwind Mutual').length).toBeGreaterThan(0);
  });

  it('still lists the dearer plans when nothing fits the budget', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const only = givenConfiguration('cfg_1', 'plan_1');
    store.configurations.find((c) => c.id === only)!.annualPrice = 1500;

    const params = new URLSearchParams({
      insuranceTypeId: 'type_1',
      customerTypeId: 'INDIVIDUAL',
      geographicalCoverageId: 'LOCAL',
      currency: 'EGP',
      ageFrom: '35',
      ageTo: '35',
      budget: '400',
    });
    renderApp(`${ROUTES.comparison.results}?${params.toString()}`);

    // The budget is never a dead end: say so, then show what is above it.
    expect(
      await screen.findByRole('heading', { name: 'No plans found within your budget' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Above your budget' })).toBeInTheDocument();
    expect(await screen.findByText('BEST ABOVE YOUR BUDGET')).toBeInTheDocument();
  });

  it('counts plans, benefits, companies and types from the database', async () => {
    givenCompany('company_1', 'Northwind Assurance');
    givenCompany('company_2', 'Southwind Mutual');
    givenInsuranceType();
    givenPlan();
    givenOption('option_1', 'Aurora Wellness Programme');
    givenOption('option_2', 'Zenith Travel Assistance');

    renderApp(ROUTES.dashboard);

    // The label sits in the tile's header row; the count is its sibling. Tiles
    // show a dash until their query lands, so wait for the real figure.
    const tile = (label: string) =>
      screen.getByText(label).parentElement?.parentElement?.textContent ?? '';

    await screen.findByText('Available plans');
    await waitFor(() => {
      expect(tile('Available plans')).toMatch(/1/);
      expect(tile('Benefits')).toMatch(/2/);
      expect(tile('Insurance companies')).toMatch(/2/);
      expect(tile('Insurance types')).toMatch(/1/);
    });
  });

  it('makes each dashboard tile a link to its own screen', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.dashboard);

    // The whole tile is the link, so it is reachable by keyboard, not just by
    // clicking the words.
    for (const [label, href] of [
      ['Companies', ROUTES.companies.list],
      ['Plans', ROUTES.plans.list],
      ['Insurance types', ROUTES.insuranceTypes.list],
    ] as const) {
      const tile = (await screen.findAllByRole('link', { name: new RegExp(label, 'i') })).find(
        (link) => link.getAttribute('href') === href,
      );
      expect(tile, `${label} tile should link to ${href}`).toBeDefined();
    }
  });

  it('opens the plans list from the dashboard tile', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.dashboard);

    const tile = (await screen.findAllByRole('link', { name: /Plans/i })).find(
      (link) => link.getAttribute('href') === ROUTES.plans.list,
    );
    await user.click(tile!);

    expect(await screen.findByRole('heading', { name: 'Plans', level: 1 })).toBeInTheDocument();
    // The plan itself, with the company it belongs to. `DataTable` renders a
    // desktop table and a mobile list, so each value legitimately appears twice.
    expect((await screen.findAllByText('Tier One')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Northwind Assurance').length).toBeGreaterThan(0);
  });

  it('opens the insurance types list from the dashboard tile', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType('type_1', 'Aurora Medical Cover');
    givenPlan();

    renderApp(ROUTES.dashboard);

    const tile = (await screen.findAllByRole('link', { name: /Insurance types/i })).find(
      (link) => link.getAttribute('href') === ROUTES.insuranceTypes.list,
    );
    await user.click(tile!);

    expect(
      await screen.findByRole('heading', { name: 'Insurance types', level: 1 }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Aurora Medical Cover')).length).toBeGreaterThan(0);
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
    expect(await screen.findByText('There is nothing to compare yet')).toBeInTheDocument();
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
    expect(screen.queryByText('There is nothing to compare yet')).not.toBeInTheDocument();
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
    // The plan's first configuration needs the age band it applies to.
    await user.type(dialog.getByLabelText(/Age from/i), '18');
    await user.type(dialog.getByLabelText(/Age to/i), '60');
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
    await user.type(dialog.getByLabelText(/Age from/i), '18');
    await user.type(dialog.getByLabelText(/Age to/i), '60');
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

    await user.type(screen.getByLabelText(/Age from/i), '18');
    await user.type(screen.getByLabelText(/Age to/i), '40');
    await user.type(screen.getByLabelText(/Currency/i), 'EGP');
    await user.type(screen.getByLabelText(/Annual price/i), '7500');
    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));
    expect(store.configurations[0]).toMatchObject({
      customerType: 'INDIVIDUAL',
      geographicalCoverage: 'LOCAL',
      ageFrom: 18,
      ageTo: 40,
      annualPrice: 7500,
    });
  });

  it('refuses to save a configuration without an age band', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add configuration/i }))[0]!);

    const who = await screen.findByRole('group', { name: /Who is this for/i });
    await user.click(within(who).getAllByRole('radio')[0]!);
    await user.click(within(screen.getByRole('group', { name: /Geographical coverage/i })).getAllByRole('radio')[0]!);

    // Age To only — Age From is missing.
    await user.type(screen.getByLabelText(/Age to/i), '40');
    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    expect(await screen.findByText('Age From is required.')).toBeInTheDocument();
    expect(store.configurations).toHaveLength(0);
  });

  it('refuses an age band that runs backwards', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add configuration/i }))[0]!);

    const who = await screen.findByRole('group', { name: /Who is this for/i });
    await user.click(within(who).getAllByRole('radio')[0]!);
    await user.click(within(screen.getByRole('group', { name: /Geographical coverage/i })).getAllByRole('radio')[0]!);

    await user.type(screen.getByLabelText(/Age from/i), '50');
    await user.type(screen.getByLabelText(/Age to/i), '30');
    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    expect(
      await screen.findByText('Age From cannot be greater than Age To.'),
    ).toBeInTheDocument();
    expect(store.configurations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Dynamic benefits
// ---------------------------------------------------------------------------

describe('dynamic insurance options', () => {
  it('creates a benefit from a name alone, typed as a percentage', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: /New benefit/i }));

    // The whole modal: one input, one Save. Nothing to configure.
    await user.type(await screen.findByLabelText(/Benefit name/i), 'Aurora Wellness Programme');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(store.options).toHaveLength(1));
    expect(store.options[0]?.name).toBe('Aurora Wellness Programme');
    // The employee never chose this — the benefit is a percentage by definition.
    expect(store.options[0]?.fields?.map((f) => f.dataType)).toEqual(['PERCENTAGE']);
  });

  it('offers a saved benefit under Available benefits, draggable and labelled Percentage', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    // The card itself is the draggable item, so the benefit is what gets dragged.
    const card = await screen.findByRole('button', { name: 'Drag Aurora Wellness Programme' });
    expect(card).toBeInTheDocument();
    expect(within(card).getByText('Percentage')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add Aurora Wellness Programme' }),
    ).toBeInTheDocument();
  });

  it('saves a percentage automatically, with no Save button to press', async () => {
    const user = userEvent.setup();
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

    const input = await screen.findByLabelText('Aurora Wellness Programme value');
    expect(
      screen.queryByRole('button', { name: 'Save Aurora Wellness Programme' }),
    ).not.toBeInTheDocument();

    await user.type(input, '80');
    // Leaving the field flushes the debounce rather than waiting it out.
    await user.tab();

    await waitFor(() => expect(store.values).toHaveLength(1));
    expect(store.values[0]?.optionFieldId).toBe('option_1_percentage');
    expect(store.values[0]?.value).toBe(80);
    expect(await screen.findByText(/Saved/)).toBeInTheDocument();
  });

  it('keeps an unsaved percentage on screen and offers a retry', async () => {
    const user = userEvent.setup();
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

    store.failNext = {
      method: 'PUT',
      path: /^\/plan-options\/.+\/values$/,
      status: 503,
      body: {
        ok: false,
        error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not reachable.' },
      },
    };

    const input = await screen.findByLabelText('Aurora Wellness Programme value');
    await user.type(input, '90');
    await user.tab();

    // The value the employee typed is still there, and saving can be retried.
    const retry = await screen.findByRole('button', {
      name: 'Retry saving Aurora Wellness Programme',
    });
    expect(input).toHaveValue(90);
    expect(store.values).toHaveLength(0);

    await user.click(retry);
    await waitFor(() => expect(store.values).toHaveLength(1));
    expect(store.values[0]?.value).toBe(90);
  });

  it('renders a different benefit with a completely different field shape', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    store.options.push({
      id: 'option_2',
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

    expect(await screen.findByLabelText('Aurora Wellness Programme value')).toBeInTheDocument();
    expect(store.planOptions).toHaveLength(1);
  });

  it('shows a dropped benefit before the server answers, and takes it back if the save fails', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    expect(await screen.findByText('Aurora Wellness Programme')).toBeInTheDocument();

    store.failNext = {
      method: 'POST',
      path: /^\/plan-configurations\/.+\/options$/,
      status: 503,
      delayMs: 120,
      body: {
        ok: false,
        error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not reachable.' },
      },
    };

    fireEvent.click(screen.getByRole('button', { name: 'Add Aurora Wellness Programme' }));

    // It is in the coverage list straight away, before any response.
    expect(
      await screen.findByRole('button', { name: 'Remove Aurora Wellness Programme' }),
    ).toBeInTheDocument();

    // The save failed, so the row must not stay on screen pretending otherwise.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remove Aurora Wellness Programme' }),
      ).not.toBeInTheDocument(),
    );
    expect(store.planOptions).toHaveLength(0);
    expect(await screen.findByText(/database is not available/i)).toBeInTheDocument();
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
    await user.type(await screen.findByLabelText('Aurora Wellness Programme value'), '80');
    await user.tab();
    await waitFor(() => expect(store.values).toHaveLength(1));
    first.unmount();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', family));
    await user.type(await screen.findByLabelText('Aurora Wellness Programme value'), '90');
    await user.tab();
    await waitFor(() => expect(store.values).toHaveLength(2));

    const coverageFor = (planOptionId: string) =>
      store.values.find(
        (v) => v.planOptionId === planOptionId && v.optionFieldId === 'option_1_percentage',
      )?.value;

    expect(coverageFor('po_individual')).toBe(80);
    expect(coverageFor('po_family')).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Global benefits
// ---------------------------------------------------------------------------

describe('global benefits', () => {
  /** Two companies whose plans deliberately use DIFFERENT insurance types. */
  function givenTwoCompanies() {
    givenCompany('company_a', 'Alpha Assurance');
    givenCompany('company_b', 'Beta Assurance');
    givenInsuranceType('type_basic', 'Basic');
    givenInsuranceType('type_premium', 'Premium');
    givenPlan('plan_a', 'company_a', 'type_basic');
    givenPlan('plan_b', 'company_b', 'type_premium');
    return {
      a: givenConfiguration('cfg_a', 'plan_a'),
      b: givenConfiguration('cfg_b', 'plan_b'),
    };
  }

  it('offers a benefit created once to every company, whatever the insurance type', async () => {
    const { a, b } = givenTwoCompanies();
    // Created once. It belongs to no company and no type.
    givenOption('option_1', 'Outpatient Care');

    const first = renderApp(ROUTES.configurations.detail('company_a', 'plan_a', a));
    expect(await screen.findByRole('button', { name: 'Add Outpatient Care' })).toBeInTheDocument();
    first.unmount();

    renderApp(ROUTES.configurations.detail('company_b', 'plan_b', b));
    expect(await screen.findByRole('button', { name: 'Add Outpatient Care' })).toBeInTheDocument();

    // Nobody had to create it twice.
    expect(store.options).toHaveLength(1);
  });

  it('lets two companies hold the same benefit at different percentages', async () => {
    const user = userEvent.setup();
    const { a, b } = givenTwoCompanies();
    givenOption('option_1', 'Outpatient Care');
    store.planOptions.push(
      { id: 'po_a', planConfigurationId: a, optionId: 'option_1', sortOrder: 0 },
      { id: 'po_b', planConfigurationId: b, optionId: 'option_1', sortOrder: 0 },
    );

    const first = renderApp(ROUTES.configurations.detail('company_a', 'plan_a', a));
    await user.type(await screen.findByLabelText('Outpatient Care value'), '80');
    await user.tab();
    await waitFor(() => expect(store.values).toHaveLength(1));
    first.unmount();

    renderApp(ROUTES.configurations.detail('company_b', 'plan_b', b));
    await user.type(await screen.findByLabelText('Outpatient Care value'), '60');
    await user.tab();
    await waitFor(() => expect(store.values).toHaveLength(2));

    // One benefit record, two independent coverage values.
    expect(store.options).toHaveLength(1);
    expect(store.planOptions.every((planOption) => planOption.optionId === 'option_1')).toBe(true);
    expect(store.values.find((v) => v.planOptionId === 'po_a')?.value).toBe(80);
    expect(store.values.find((v) => v.planOptionId === 'po_b')?.value).toBe(60);
  });

  it('creates no second record when the same benefit is dropped on another plan', async () => {
    const { a, b } = givenTwoCompanies();
    givenOption('option_1', 'Outpatient Care');

    const first = renderApp(ROUTES.configurations.detail('company_a', 'plan_a', a));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Outpatient Care' }));
    await waitFor(() => expect(store.planOptions).toHaveLength(1));
    first.unmount();

    renderApp(ROUTES.configurations.detail('company_b', 'plan_b', b));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Outpatient Care' }));
    await waitFor(() => expect(store.planOptions).toHaveLength(2));

    // Two relationships, still ONE benefit, both pointing at it.
    expect(store.options).toHaveLength(1);
    expect(store.planOptions.map((planOption) => planOption.optionId)).toEqual([
      'option_1',
      'option_1',
    ]);
  });

  it('refuses a benefit whose name already exists', async () => {
    const user = userEvent.setup();
    const { a } = givenTwoCompanies();
    givenOption('option_1', 'Dental');

    renderApp(ROUTES.configurations.detail('company_a', 'plan_a', a));

    await user.click(await screen.findByRole('button', { name: /New benefit/i }));
    // Different casing — still the same benefit.
    await user.type(await screen.findByLabelText(/Benefit name/i), 'dental');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(store.options).toHaveLength(1);
  });
});
