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

import { UNSPECIFIED_OPTION_LABEL } from '@aggregator/shared';
import type { CustomerTypeId, OptionFieldDto } from '@aggregator/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    isActive: true,
    ...timestamps,
  });
  return id;
}

/** A benefit invented here: a name, and the percentage every benefit carries. */
/**
 * A benefit answered from an ordered list, e.g. a provider network.
 *
 * The list belongs to the BENEFIT, so it is defined once here and every plan
 * that carries the benefit picks from it.
 */
/**
 * A benefit with a setting that takes SEVERAL answers, e.g. the conditions on
 * a dental limit.
 *
 * The list belongs to the setting, so it is defined against the field rather
 * than against the benefit: one benefit asks several questions at once.
 */
function givenMultiSetting(optionId = 'option_1', label = 'Limitations') {
  const option = store.options.find((entry) => entry.id === optionId);
  if (!option) throw new Error('define the benefit first');
  const fieldId = `${optionId}_multi`;
  option.fields = [
    ...(option.fields ?? []),
    {
      id: fieldId,
      optionId,
      label,
      key: 'limitations',
      dataType: 'MULTI',
      unit: null,
      helpText: null,
      isRequired: false,
      sortOrder: 1,
      isActive: true,
      isOptional: false,
      parentFieldId: null,
      showWhenChoiceId: null,
      customerTypes: [],
      ...timestamps,
    },
  ];
  return fieldId;
}

/** One answer on a setting's ranked list, at the rank given. */
function givenAnswer(id: string, optionFieldId: string, label: string, sortOrder: number) {
  store.choices.push({
    id,
    optionFieldId,
    label,
    sortOrder,
    rankCount: 0,
    isActive: true,
    ...timestamps,
  });
}

function givenRankedOption(id = 'option_1', name = 'Medical Network') {
  store.options.push({
    id,
    name,
    description: null,
    sortOrder: 0,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [
      {
        id: `${id}_rank`,
        optionId: id,
        label: 'Rank',
        key: 'rank',
        dataType: 'RANK',
        unit: null,
        helpText: null,
        isRequired: false,
        sortOrder: 0,
        isActive: true,
        isOptional: false,
        parentFieldId: null,
        showWhenChoiceId: null,
        customerTypes: [],
        ...timestamps,
      },
    ],
  });
  store.choices.push(
    {
      id: 'choice_gold',
      optionFieldId: `${id}_rank`,
      label: 'Golden Care Network',
      sortOrder: 0,
      rankCount: 2,
      isActive: true,
      ...timestamps,
    },
    {
      id: 'choice_orange',
      optionFieldId: `${id}_rank`,
      label: 'Orange Care Network',
      sortOrder: 1,
      rankCount: 2,
      isActive: true,
      ...timestamps,
    },
  );
}

function givenOption(id = 'option_1', name = 'Aurora Wellness Programme') {
  store.options.push({
    id,
    name,
    description: null,
    sortOrder: 0,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [
      {
        id: `${id}_percentage`,
        optionId: id,
        label: 'Percentage',
        key: 'percentage',
        dataType: 'PERCENTAGE',
        unit: '%',
        helpText: null,
        isRequired: false,
        sortOrder: 0,
        isActive: true,
        isOptional: false,
        parentFieldId: null,
        showWhenChoiceId: null,
        customerTypes: [],
        ...timestamps,
      },
    ],
  });
  return id;
}

/** A benefit worth a limit, or quoted as a percentage instead. */
function givenOptionWithAlternative(id = 'option_1', name = 'Dental') {
  store.options.push({
    id,
    name,
    description: null,
    sortOrder: 0,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [
      {
        id: `${id}_limit`,
        optionId: id,
        label: 'Limit',
        key: 'limit',
        dataType: 'CURRENCY',
        unit: null,
        helpText: null,
        isRequired: false,
        sortOrder: 0,
        isActive: true,
        ...timestamps,
      },
      {
        id: `${id}_alternative`,
        optionId: id,
        label: 'Or percentage',
        key: 'alternative',
        dataType: 'PERCENTAGE',
        unit: '%',
        helpText: null,
        isRequired: false,
        sortOrder: 1,
        isActive: true,
        ...timestamps,
      },
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
    expect(
      await screen.findByRole('heading', { name: 'Start Comparing', level: 1 }),
    ).toBeInTheDocument();

    // The company list is no longer the dashboard's content — the company's
    // own name must not appear on it.
    expect(screen.queryByText('Northwind Assurance')).not.toBeInTheDocument();

    // The primary action reaches the real comparison flow.
    await user.click(screen.getByRole('link', { name: /Start Comparing/i }));
    expect(
      await screen.findByRole('heading', { name: 'Insurance plan', level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('group', { name: /Who do you want to insure/i }),
    ).toBeInTheDocument();
  });

  it('asks for one age and a budget, and never for benefits', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    givenConfiguration('cfg_1', 'plan_1');
    givenOption();

    renderApp(ROUTES.comparison.new);

    expect(
      await screen.findByRole('heading', { name: 'Insurance plan', level: 1 }),
    ).toBeInTheDocument();

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
    expect(
      await screen.findByRole('heading', { name: 'Insurance types', level: 1 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add insurance type/i }));

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/^Name/), 'Motor');
    await user.click(dialog.getByRole('button', { name: /Add type/i }));

    await waitFor(() => expect(store.insuranceTypes).toHaveLength(2));
    expect(store.insuranceTypes[1]?.name).toBe('Motor');
    // The new category appears in the list it was added from.
    await waitFor(() => expect(screen.getAllByText('Motor').length).toBeGreaterThan(0));
  });

  it('never lets a wheel scroll rewrite a number, on any numeric field', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.comparison.new);
    await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });
    await user.click(screen.getByRole('radio', { name: /Individual/i }));

    const age = screen.getByLabelText(/^Age/);
    await user.type(age, '35');
    expect(age).toHaveValue(35);

    // Scrolling over the focused field is how a price or an age gets silently
    // rewritten. The value must not move.
    expect(age).toHaveFocus();
    fireEvent.wheel(age, { deltaY: -120 });
    expect(age).toHaveValue(35);
    // Focus is dropped, which is what stops the browser spinning the value —
    // and leaves the page free to scroll as normal.
    expect(age).not.toHaveFocus();

    fireEvent.wheel(age, { deltaY: 240 });
    expect(age).toHaveValue(35);

    // Typing still works afterwards.
    await user.clear(age);
    await user.type(age, '41');
    expect(age).toHaveValue(41);

    // The budget field is the same control, and so is every generated one.
    await user.click(screen.getByRole('radio', { name: /Enter an amount/i }));
    const budget = await screen.findByLabelText(/^Amount/);
    await user.type(budget, '700');
    fireEvent.wheel(budget, { deltaY: -120 });
    expect(budget).toHaveValue(700);
  });

  it('leaves the wheel alone on inputs that are not numeric', async () => {
    const user = userEvent.setup();
    givenCompany();

    renderApp(ROUTES.companies.list);
    const search = await screen.findByLabelText(/Search companies/i);
    await user.click(search);

    // A text field has no wheel behaviour to guard against, so focus stays put.
    expect(search).toHaveFocus();
    fireEvent.wheel(search, { deltaY: -120 });
    expect(search).toHaveFocus();
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
    expect(await screen.findByText('Age From cannot be greater than Age To.')).toBeInTheDocument();
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
    const modes = await screen.findAllByRole('radio', {
      name: /Work it out for me|Enter an amount/i,
    });
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
    expect(await screen.findByRole('heading', { name: 'Above your budget' })).toBeInTheDocument();
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
    expect(await screen.findByText(/Set up plans for Northwind Assurance/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();
  });

  it('shows the API validation message on the offending field', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.companies.new);

    await user.click(await screen.findByRole('button', { name: /Create company/i }));

    expect(await screen.findByText(/Please correct the highlighted fields/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/String must contain at least 1 character/i),
    ).toBeInTheDocument();
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
// The provider networks a company sells
// ---------------------------------------------------------------------------

/** A network on one company's list, at the rank given. */
function givenNetwork(id: string, companyId: string, name: string, sortOrder: number) {
  store.medicalNetworks.push({
    id,
    companyId,
    name,
    description: null,
    sortOrder,
    isActive: true,
    ...timestamps,
  });
  return id;
}

/** The network names as the card renders them, top of the ranking first. */
async function renderedNetworks() {
  const list = await screen.findByRole('list', { name: /medical networks/i });
  return within(list)
    .getAllByRole('listitem')
    .map((row) => row.textContent ?? '');
}

describe('company medical networks', () => {
  it('shows a company only its OWN networks, never another company’s', async () => {
    givenCompany('company_1', 'Northwind Assurance');
    givenCompany('company_2', 'Southgate Mutual');
    givenNetwork('net_a1', 'company_1', 'Golden Care Network', 0);
    givenNetwork('net_a2', 'company_1', 'Silver Care Network', 1);
    givenNetwork('net_b1', 'company_2', 'Harbour Hospitals', 0);

    const northwind = renderApp(ROUTES.companies.detail('company_1'));
    expect(await screen.findByText('Golden Care Network')).toBeInTheDocument();
    expect(screen.getByText('Silver Care Network')).toBeInTheDocument();
    // The other insurer's estate is absent, not merely ranked below.
    expect(screen.queryByText('Harbour Hospitals')).not.toBeInTheDocument();
    northwind.unmount();

    renderApp(ROUTES.companies.detail('company_2'));
    expect(await screen.findByText('Harbour Hospitals')).toBeInTheDocument();
    expect(screen.queryByText('Golden Care Network')).not.toBeInTheDocument();
    expect(screen.queryByText('Silver Care Network')).not.toBeInTheDocument();
  });

  it('reads the list in the company’s own ranking, not the order it was typed', async () => {
    givenCompany();
    // Seeded deliberately out of insertion order: rank is what the row is.
    givenNetwork('net_3', 'company_1', 'Basic Network', 2);
    givenNetwork('net_1', 'company_1', 'Golden Care Network', 0);
    givenNetwork('net_2', 'company_1', 'Silver Care Network', 1);

    renderApp(ROUTES.companies.detail('company_1'));

    const rows = await renderedNetworks();
    expect(rows[0]).toContain('Golden Care Network');
    expect(rows[1]).toContain('Silver Care Network');
    expect(rows[2]).toContain('Basic Network');
    // Positions are shown, so the ranking is legible without dragging anything.
    expect(rows[0]).toContain('1.');
    expect(rows[2]).toContain('3.');
  });

  it('persists a new ranking and re-reads the list from it', async () => {
    givenCompany();
    givenNetwork('net_1', 'company_1', 'Golden Care Network', 0);
    givenNetwork('net_2', 'company_1', 'Silver Care Network', 1);
    givenNetwork('net_3', 'company_1', 'Basic Network', 2);

    const first = renderApp(ROUTES.companies.detail('company_1'));

    // Every row offers a handle, so any of them can be moved.
    expect(
      await screen.findByRole('button', { name: /Reorder Golden Care Network/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reorder Basic Network/i })).toBeInTheDocument();

    // jsdom reports zero-sized rects, so dnd-kit cannot resolve a pointer drop
    // target. The endpoint the card calls on drop is exercised directly.
    await fetch('/api/v1/companies/company_1/medical-networks/reorder', {
      method: 'POST',
      body: JSON.stringify({ orderedIds: ['net_1', 'net_3', 'net_2'] }),
    });

    const rankOf = (id: string) =>
      store.medicalNetworks.find((network) => network.id === id)?.sortOrder;
    expect(rankOf('net_1')).toBe(0);
    expect(rankOf('net_3')).toBe(1);
    expect(rankOf('net_2')).toBe(2);

    // And the saved ranking is what the card reads back.
    first.unmount();
    renderApp(ROUTES.companies.detail('company_1'));
    const rows = await renderedNetworks();
    expect(rows[0]).toContain('Golden Care Network');
    expect(rows[1]).toContain('Basic Network');
    expect(rows[2]).toContain('Silver Care Network');
  });

  it('refuses to reorder using a network belonging to another company', async () => {
    givenCompany('company_1');
    givenCompany('company_2', 'Southgate Mutual');
    givenNetwork('net_a1', 'company_1', 'Golden Care Network', 0);
    givenNetwork('net_b1', 'company_2', 'Harbour Hospitals', 0);

    const response = await fetch('/api/v1/companies/company_1/medical-networks/reorder', {
      method: 'POST',
      body: JSON.stringify({ orderedIds: ['net_b1', 'net_a1'] }),
    });

    expect(response.status).toBe(400);
    // Neither company's ranking moved.
    expect(store.medicalNetworks.every((network) => network.sortOrder === 0)).toBe(true);
  });

  it('adds a network at the bottom of the ranking, with no Save button', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenNetwork('net_1', 'company_1', 'Golden Care Network', 0);

    renderApp(ROUTES.companies.detail('company_1'));

    await user.type(
      await screen.findByLabelText(/New medical network/i),
      'Silver Care Network{Enter}',
    );

    await waitFor(() => expect(store.medicalNetworks).toHaveLength(2));
    // The end, not the top: nobody has said it is better than what is there.
    expect(store.medicalNetworks[1]).toMatchObject({
      companyId: 'company_1',
      name: 'Silver Care Network',
      sortOrder: 1,
    });
    expect(await screen.findByText('Silver Care Network')).toBeInTheDocument();
  });

  it('renames a network in place', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenNetwork('net_1', 'company_1', 'Golden Care Netwrok', 0);

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click(await screen.findByRole('button', { name: /Edit Golden Care Netwrok/i }));

    const input = await screen.findByLabelText(/Rename Golden Care Netwrok/i);
    await user.clear(input);
    await user.type(input, 'Golden Care Network{Enter}');

    await waitFor(() => expect(store.medicalNetworks[0]?.name).toBe('Golden Care Network'));
    // A plan points at the row, so the rank it was given is untouched.
    expect(store.medicalNetworks[0]?.sortOrder).toBe(0);
  });

  it('deletes a network nothing is sold on, without asking', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    givenCompany();
    givenNetwork('net_1', 'company_1', 'Golden Care Network', 0);

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click(await screen.findByRole('button', { name: /Delete Golden Care Network/i }));

    await waitFor(() => expect(store.medicalNetworks).toHaveLength(0));
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('sells a plan on a network chosen from the company’s list, never typed', async () => {
    const user = userEvent.setup();
    givenCompany('company_1', 'Northwind Assurance');
    givenCompany('company_2', 'Southgate Mutual');
    givenInsuranceType();
    givenNetwork('net_a1', 'company_1', 'Golden Care Network', 0);
    givenNetwork('net_b1', 'company_2', 'Harbour Hospitals', 0);

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    const dialog = within(await screen.findByRole('dialog'));
    const network = await dialog.findByLabelText(/Medical network/i);

    // A select, not a box: the name cannot be invented on the plan.
    expect(network.tagName).toBe('SELECT');
    const offered = within(network)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(offered).toEqual([UNSPECIFIED_OPTION_LABEL, 'Golden Care Network']);

    await user.type(dialog.getByLabelText(/Plan name/i), 'Tier One');
    await user.type(dialog.getByLabelText(/Annual limit/i), '600000');
    await user.selectOptions(network, 'net_a1');
    await user.type(dialog.getByLabelText('Premium, ages 1 to 17'), '3681');
    await user.click(dialog.getByRole('button', { name: /Save plan/i }));

    await waitFor(() => expect(store.plans).toHaveLength(1));
    // Recorded on the VARIANT: the same plan sold on another network is a
    // second variant, not a second plan.
    expect(store.configurations[0]?.medicalNetworkId).toBe('net_a1');
    expect(store.medicalNetworks).toHaveLength(2);
  });

  it('refuses a variant sold on another company’s network', async () => {
    givenCompany('company_1');
    givenCompany('company_2', 'Southgate Mutual');
    givenInsuranceType();
    givenPlan();
    givenNetwork('net_b1', 'company_2', 'Harbour Hospitals', 0);

    const response = await fetch('/api/v1/plan-configurations', {
      method: 'POST',
      body: JSON.stringify({
        planId: 'plan_1',
        customerType: 'INDIVIDUAL',
        geographicalCoverage: 'LOCAL',
        ageFrom: 18,
        ageTo: 60,
        medicalNetworkId: 'net_b1',
      }),
    });

    expect(response.status).toBe(400);
    expect(store.configurations).toHaveLength(0);
  });

  it('warns before deleting a network variants are sold on, and leaves them standing', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    givenCompany();
    givenInsuranceType();
    givenPlan();
    givenConfiguration();
    givenNetwork('net_1', 'company_1', 'Golden Care Network', 0);
    store.configurations[0]!.medicalNetworkId = 'net_1';

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click(await screen.findByRole('button', { name: /Delete Golden Care Network/i }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 priced variant is'));
    await waitFor(() => expect(store.medicalNetworks).toHaveLength(0));

    // The variant survives; it simply stops naming a network.
    expect(store.configurations).toHaveLength(1);
    expect(store.configurations[0]?.medicalNetworkId).toBeNull();
    confirm.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Plans, created inside the company
// ---------------------------------------------------------------------------

describe('plans', () => {
  it('files a medical plan under a Medical type it creates itself', async () => {
    const user = userEvent.setup();
    givenCompany();

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    // Scope to the dialog: a real <dialog> makes the page behind it inert, but
    // jsdom keeps the trigger button queryable.
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Plan name/i), 'Tier One');
    await user.type(dialog.getByLabelText(/Annual limit/i), '600000');
    await user.type(dialog.getByLabelText('Premium, ages 1 to 17'), '3681');
    await user.click(dialog.getByRole('button', { name: /Save plan/i }));

    await waitFor(() => expect(store.plans).toHaveLength(1));
    // The form is medical-specific, so the employee is never asked the
    // category. Refiling a plan elsewhere remains possible when editing it.
    expect(store.insuranceTypes).toHaveLength(1);
    expect(store.insuranceTypes[0]?.name).toBe('Medical');
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

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Plan name/i), 'Tier One');
    await user.type(dialog.getByLabelText(/Annual limit/i), '600000');
    await user.type(dialog.getByLabelText('Premium, ages 1 to 17'), '7500');
    await user.click(dialog.getByRole('button', { name: /Save plan/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));

    // The product carries no pricing; its configuration does.
    expect(store.plans[0]).not.toHaveProperty('annualPrice');
    expect(store.configurations[0]).toMatchObject({
      planId: store.plans[0]?.id,
      customerType: 'INDIVIDUAL',
      geographicalCoverage: 'LOCAL',
      annualPrice: 7500,
      annualLimit: 600000,
    });
  });

  /**
   * The point of the form: age is a pricing axis, not a benefit axis.
   *
   * The legacy data said so outright — across 32 products, all 69 age rows of
   * each carried an identical benefit set, and only the premium moved. So the
   * benefits are filled in once and every band priced carries them.
   */
  it('enters benefits once and carries them onto every age band priced', async () => {
    const user = userEvent.setup();
    givenCompany();

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Plan name/i), 'Elite');
    await user.type(dialog.getByLabelText(/Annual limit/i), '600000');
    await user.type(dialog.getByLabelText('In-patient coverage'), 'Fully Covered');

    // Three bands, three premiums, one benefit entry.
    await user.type(dialog.getByLabelText('Premium, ages 1 to 17'), '3681');
    await user.type(dialog.getByLabelText('Premium, ages 18 to 24'), '5701');
    await user.type(dialog.getByLabelText('Premium, ages 25 to 29'), '7132');
    await user.click(dialog.getByRole('button', { name: /Save plan/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(3));

    // A band with no premium is simply not sold, so no configuration is made.
    expect(store.configurations.map((item) => item.annualPrice)).toEqual([3681, 5701, 7132]);

    // The benefit is attached to each of them, valued the same.
    for (const configuration of store.configurations) {
      const attached = store.planOptions.filter(
        (item) => item.planConfigurationId === configuration.id,
      );
      expect(attached).toHaveLength(1);
    }
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
    await user.click(
      within(screen.getByRole('group', { name: /Geographical coverage/i })).getAllByRole(
        'radio',
      )[0]!,
    );

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
    await user.click(
      within(screen.getByRole('group', { name: /Geographical coverage/i })).getAllByRole(
        'radio',
      )[0]!,
    );

    await user.type(screen.getByLabelText(/Age from/i), '50');
    await user.type(screen.getByLabelText(/Age to/i), '30');
    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    expect(await screen.findByText('Age From cannot be greater than Age To.')).toBeInTheDocument();
    expect(store.configurations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Figures: grouped as typed, and blank when the plan says nothing
// ---------------------------------------------------------------------------

describe('figures', () => {
  it('groups a limit in thousands as it is typed, and stores the plain number', async () => {
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

    const limit = screen.getByLabelText(/Annual limit/i);
    await user.type(limit, '100000');
    // Read back the way the plan document writes it.
    expect(limit).toHaveValue('100,000');

    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));
    // What is stored is a number, never the separators.
    expect(store.configurations[0]?.annualLimit).toBe(100000);
  });

  it('reads a figure the plan never stated as not specified, never as zero', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    store.configurations[0]!.deductible = null;
    store.configurations[0]!.coPayment = null;

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const summary = await screen.findByText('Deductible');
    expect(summary.parentElement).toHaveTextContent('Not specified in plan');
    expect(screen.queryByText('0 EGP')).not.toBeInTheDocument();
  });
});

describe('editing a plan', () => {
  it('files a plan under a different insurance type without touching its cover', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType('type_1', 'Medium');
    givenInsuranceType('type_2', 'High');
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click(await screen.findByRole('button', { name: /Edit plan/i }));

    // The type is offered when editing, not only when creating.
    const select = await screen.findByLabelText(/Insurance type/i);
    expect(select).toHaveValue('type_1');
    await user.selectOptions(select, 'type_2');
    await user.click(screen.getByRole('button', { name: /Save plan/i }));

    await waitFor(() => expect(store.plans[0]?.insuranceTypeId).toBe('type_2'));
    // Refiling carries nothing with it: the cover is exactly as it was.
    expect(store.configurations).toHaveLength(1);
    expect(store.planOptions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Copying a plan
// ---------------------------------------------------------------------------

describe('copying a plan', () => {
  /** A plan priced for two age bands, the first carrying a benefit. */
  function givenPricedPlan() {
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const younger = givenConfiguration('cfg_1', 'plan_1');
    store.configurations.push({
      ...store.configurations[0]!,
      id: 'cfg_2',
      ageFrom: 41,
      ageTo: 60,
      annualPrice: 15984,
    });
    givenOption();
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: younger,
      optionId: 'option_1',
      sortOrder: 0,
      note: '1 in 10 members ratio',
    });
    store.values.push({
      planOptionId: 'planOption_1',
      optionFieldId: 'option_1_percentage',
      value: 80,
    });
  }

  it('refuses to copy a plan under the same name', async () => {
    const user = userEvent.setup();
    givenPricedPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click(await screen.findByRole('button', { name: /Copy plan/i }));

    await user.type(await screen.findByLabelText(/New plan name/i), 'Tier One');

    // Nothing is sent: the name is the one thing a copy must change.
    expect(await screen.findByText(/different name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create the copy/i })).toBeDisabled();
    expect(store.plans).toHaveLength(1);
  });

  it('copies only the configurations chosen, with their benefits and notes', async () => {
    const user = userEvent.setup();
    givenPricedPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click(await screen.findByRole('button', { name: /Copy plan/i }));

    await user.type(await screen.findByLabelText(/New plan name/i), 'Tier Two');
    // The code follows the name unless one is typed.
    expect(screen.getByLabelText(/Plan code/i)).toHaveValue('TIER-TWO');

    // Everything is selected by default; drop the older band.
    const choices = screen.getAllByRole('checkbox');
    expect(choices).toHaveLength(2);
    await user.click(choices[1]!);

    await user.click(screen.getByRole('button', { name: /Create the copy/i }));

    await waitFor(() => expect(store.plans).toHaveLength(2));
    const copy = store.plans[1]!;
    expect(copy.name).toBe('Tier Two');
    expect(copy.code).toBe('TIER-TWO');

    // One configuration came across, with its benefit, value and note.
    const copied = store.configurations.filter((item) => item.planId === copy.id);
    expect(copied).toHaveLength(1);
    expect(copied[0]?.ageFrom).toBe(18);

    const attachments = store.planOptions.filter(
      (item) => item.planConfigurationId === copied[0]!.id,
    );
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.note).toBe('1 in 10 members ratio');
    expect(store.values.find((v) => v.planOptionId === attachments[0]!.id)?.value).toBe(80);

    // The plan it was copied from is untouched.
    expect(store.configurations.filter((item) => item.planId === 'plan_1')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// The same cover at another age
// ---------------------------------------------------------------------------

describe('add different age', () => {
  it('copies a configuration to a new band with its benefits and their values', async () => {
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
    store.values.push({
      planOptionId: 'planOption_1',
      optionFieldId: 'option_1_percentage',
      value: 80,
    });

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));

    await user.click(await screen.findByRole('button', { name: /Add different age/i }));
    await user.type(await screen.findByLabelText(/Age from/i), '41');
    await user.type(screen.getByLabelText(/Age to/i), '45');
    // The premium is the one thing that changes with the band.
    const price = screen.getByLabelText(/Annual price/i);
    await user.clear(price);
    await user.type(price, '15984');
    await user.click(screen.getByRole('button', { name: /Add this age/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(2));
    const copy = store.configurations[1]!;
    expect(copy.ageFrom).toBe(41);
    expect(copy.ageTo).toBe(45);
    expect(copy.annualPrice).toBe(15984);
    // Nothing was re-entered: the benefit and its value came across.
    const copied = store.planOptions.filter((item) => item.planConfigurationId === copy.id);
    expect(copied).toHaveLength(1);
    expect(store.values.filter((value) => value.planOptionId === copied[0]!.id)[0]?.value).toBe(80);
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

  it('creates a benefit that carries a limit instead of a percentage', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: /New benefit/i }));
    await user.type(await screen.findByLabelText(/Benefit name/i), 'Optical Limit');

    const kinds = await screen.findByRole('group', { name: /What does it carry/i });
    const limit = within(kinds)
      .getAllByRole('radio')
      .find((radio) => (radio.closest('label')?.textContent ?? '').includes('Limit'))!;
    await user.click(limit);
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(store.options).toHaveLength(1));
    expect(store.options[0]?.fields?.map((f) => f.dataType)).toEqual(['CURRENCY']);
  });

  it('creates a group of benefits and a sub-benefit inside it', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: /New benefit/i }));
    await user.type(await screen.findByLabelText(/Benefit name/i), 'Life & Accident Coverage');
    await user.click(screen.getByRole('checkbox', { name: /groups others under it/i }));
    // A group carries nothing, so it is never asked what it carries.
    expect(screen.queryByRole('group', { name: /What does it carry/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(store.options).toHaveLength(1));
    expect(store.options[0]?.isUmbrella).toBe(true);
    expect(store.options[0]?.fields).toEqual([]);

    await user.click(await screen.findByRole('button', { name: /New benefit in this group/i }));
    await user.type(await screen.findByLabelText(/Benefit name/i), 'Death (Natural)');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(store.options).toHaveLength(2));
    expect(store.options[1]?.parentId).toBe(store.options[0]?.id);
  });

  it('attaches a group with everything under it, and takes it all away again', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    givenOption('option_group', 'Life & Accident Coverage');
    store.options[0]!.isUmbrella = true;
    store.options[0]!.fields = [];
    givenOption('option_death', 'Death (Natural)');
    store.options[1]!.parentId = 'option_group';

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: 'Add Life & Accident Coverage' }));

    // One gesture, two rows: the heading and the benefit that belongs under it.
    await waitFor(() => expect(store.planOptions).toHaveLength(2));
    expect(await screen.findByLabelText('Death (Natural) value')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Life & Accident Coverage' }));

    // One click removes one row: the sub-benefit and its value stay put.
    await waitFor(() => expect(store.planOptions).toHaveLength(1));
    expect(store.planOptions[0]?.optionId).toBe('option_death');
    expect(await screen.findByLabelText('Death (Natural) value')).toBeInTheDocument();

    // ...and the row that is left can still be removed on its own.
    await user.click(screen.getByRole('button', { name: 'Remove Death (Natural)' }));
    await waitFor(() => expect(store.planOptions).toHaveLength(0));
  });

  it('changes what a benefit carries, keeping the figures already entered', async () => {
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
    store.values.push({
      planOptionId: 'planOption_1',
      optionFieldId: 'option_1_percentage',
      value: 80,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: 'Edit Aurora Wellness Programme' }));
    const kinds = await screen.findByRole('group', { name: /What does it carry/i });
    const limit = within(kinds)
      .getAllByRole('radio')
      .find((radio) => (radio.closest('label')?.textContent ?? '').includes('Limit'))!;
    await user.click(limit);

    // The employee is told what becomes of the figures before they commit.
    expect(await screen.findByText(/kept exactly as they are/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(store.options[0]?.fields?.[0]?.dataType).toBe('CURRENCY'));
    // Percentage and limit are the same figure in the same place: 80 survives.
    expect(store.values[0]?.value).toBe(80);
  });

  it('creates a benefit quoted two ways, and shows both boxes with OR between', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: /New benefit/i }));
    await user.type(await screen.findByLabelText(/Benefit name/i), 'Dental');

    const kinds = await screen.findByRole('group', { name: /What does it carry/i });
    await user.click(
      within(kinds)
        .getAllByRole('radio')
        .find((radio) => (radio.closest('label')?.textContent ?? '').includes('Limit'))!,
    );

    await user.click(screen.getByRole('checkbox', { name: /quoted another way/i }));
    const alternative = await screen.findByRole('group', { name: /What is the alternative/i });
    await user.click(
      within(alternative)
        .getAllByRole('radio')
        .find((radio) => (radio.closest('label')?.textContent ?? '').includes('Percentage'))!,
    );
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(store.options).toHaveLength(1));
    // Two fields: the limit it is worth, and the percentage it may be quoted as.
    expect(store.options[0]?.fields?.map((field) => field.dataType)).toEqual([
      'CURRENCY',
      'PERCENTAGE',
    ]);

    // On the plan, both are editable side by side.
    await user.click(screen.getByRole('button', { name: 'Add Dental' }));
    expect(await screen.findByLabelText('Dental value')).toBeInTheDocument();
    expect(await screen.findByLabelText('Dental alternative value')).toBeInTheDocument();
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('records a different figure in each box', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOptionWithAlternative();
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.type(await screen.findByLabelText('Dental value'), '800');
    await user.tab();
    await waitFor(() => expect(store.values).toHaveLength(1));

    await user.type(await screen.findByLabelText('Dental alternative value'), '80');
    await user.tab();
    await waitFor(() => expect(store.values).toHaveLength(2));

    // The two figures are independent values of the same benefit.
    expect(store.values.find((v) => v.optionFieldId === 'option_1_limit')?.value).toBe(800);
    expect(store.values.find((v) => v.optionFieldId === 'option_1_alternative')?.value).toBe(80);
  });

  it('adds a note to a benefit, kept per configuration', async () => {
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

    // The note stays out of the way until it is asked for.
    expect(screen.queryByLabelText('Aurora Wellness Programme note')).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole('button', { name: 'Add a note to Aurora Wellness Programme' }),
    );

    await user.type(
      await screen.findByLabelText('Aurora Wellness Programme note'),
      '1 in 10 members ratio',
    );
    await user.tab();

    await waitFor(() => expect(store.planOptions[0]?.note).toBe('1 in 10 members ratio'));
  });

  /**
   * The qualification that the comparison can actually read.
   *
   * A note saying "basic procedures only" was invisible to the engine, so two
   * plans quoting the same figure scored the same. Ticking a catalogue record
   * instead is what makes the difference count.
   */
  /**
   * The qualification the comparison can actually read.
   *
   * A note saying "basic procedures only" was invisible to the engine, so two
   * plans quoting the same figure scored the same. Ticking an answer on the
   * benefit's OWN setting is what makes the difference count.
   */
  it('ticks an answer on the benefit’s own setting', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();
    const fieldId = givenMultiSetting();
    givenAnswer('answer_1', fieldId, 'Basic procedures only', 0);
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(
      await screen.findByRole('button', {
        name: 'Limitations for Aurora Wellness Programme',
      }),
    );
    await user.click(await screen.findByLabelText(/Basic procedures only/));

    await waitFor(() => expect(store.planOptions[0]?.tickedChoiceIds).toEqual(['answer_1']));

    // The row now states the condition rather than showing an empty box.
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Limitations for Aurora Wellness Programme' }),
      ).toHaveTextContent('Basic procedures only'),
    );
  });

  /**
   * Cover that is a named tier rather than a figure.
   *
   * "Golden Care Network" is not a percentage, so it is picked from the
   * benefit's own list — never typed — and the value stored is the answer's id
   * so that reordering the list re-ranks the plans without rewriting what any
   * of them says.
   */
  it('picks a ranked answer from the benefit’s own list', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenRankedOption();
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const select = await screen.findByLabelText('Medical Network value');
    // Both answers are offered, in the employee's order.
    expect(within(select).getByRole('option', { name: 'Golden Care Network' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Orange Care Network' })).toBeInTheDocument();

    await user.selectOptions(select, 'choice_gold');

    // The ANSWER'S ID is stored, not its wording and not its position.
    await waitFor(() => expect(store.values[0]?.value).toBe('choice_gold'));
  });

  /**
   * A catalogue of thirty benefits is a scroll, not a list. The search filters
   * what is already in hand rather than refetching, so a drag in progress is
   * never cancelled underneath the employee.
   */
  it('searches the available benefits, keeping a group whose part matches', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();
    givenOption('option_2', 'Dental Care');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const search = await screen.findByLabelText('Search benefits');
    expect(await screen.findByText('Dental Care')).toBeInTheDocument();

    await user.type(search, 'aurora');

    await waitFor(() => expect(screen.queryByText('Dental Care')).not.toBeInTheDocument());
    expect(screen.getByText('Aurora Wellness Programme')).toBeInTheDocument();

    // A search that matches nothing offers the way out rather than a blank.
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(await screen.findByText(/No benefit matches/)).toBeInTheDocument();
  });

  /**
   * The ranking IS the weighting.
   *
   * Nobody can answer "is in-network-only worth 0.30 or 0.35?", so the question
   * is never asked. Dragging one condition above another says which is harsher,
   * and that is what the comparison reads.
   */
  /**
   * The ranking IS the weighting.
   *
   * Nobody can answer "is in-network-only worth 0.30 or 0.35?", so the question
   * is never asked. Dragging one answer above another says which is harsher,
   * and that is what the comparison reads.
   */
  it('ranks a setting’s answers, and renames and deletes them from the same list', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();
    const fieldId = givenMultiSetting();
    givenAnswer('answer_1', fieldId, 'Basic procedures only', 0);
    givenAnswer('answer_2', fieldId, 'In-network only', 1);
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(
      await screen.findByRole('button', {
        name: 'Limitations for Aurora Wellness Programme',
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Rank & edit' }));

    // Both ends are named, so the order is never left as a guess.
    expect(await screen.findByText(/mildest/)).toBeInTheDocument();
    expect(screen.getByText(/harshest/)).toBeInTheDocument();

    // Rename one — plans record WHICH answer they gave, so this is safe.
    await user.click(screen.getByRole('button', { name: 'Edit In-network only' }));
    const field = await screen.findByLabelText('Rename In-network only');
    await user.clear(field);
    await user.type(field, 'In-network only (no reimbursement)');
    await user.tab();

    await waitFor(() =>
      expect(store.choices.find((c) => c.id === 'answer_2')?.label).toBe(
        'In-network only (no reimbursement)',
      ),
    );

    // Delete one nothing records: no warning is needed.
    await user.click(screen.getByRole('button', { name: 'Delete Basic procedures only' }));
    await waitFor(() => expect(store.choices).toHaveLength(1));
  });

  it('warns before deleting an answer that plans still record', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();
    const fieldId = givenMultiSetting();
    givenAnswer('answer_1', fieldId, 'Basic procedures only', 0);
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
      tickedChoiceIds: ['answer_1'],
    });

    // Removing it makes that benefit read as UNRESTRICTED, so the API refuses
    // and the count is put to the employee. Declining leaves everything alone.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(
      await screen.findByRole('button', {
        name: 'Limitations for Aurora Wellness Programme',
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Rank & edit' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Basic procedures only' }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(store.choices).toHaveLength(1);
    confirm.mockRestore();
  });

  it('adds an answer the setting does not offer yet, without leaving the row', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();
    givenMultiSetting();
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(
      await screen.findByRole('button', {
        name: 'Limitations for Aurora Wellness Programme',
      }),
    );
    await user.type(await screen.findByLabelText('New answer'), 'In-network only');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    // Created AND ticked: an employee who typed it plainly meant it to apply.
    await waitFor(() => expect(store.choices).toHaveLength(1));
    await waitFor(() => expect(store.planOptions[0]?.tickedChoiceIds).toHaveLength(1));
  });

  it('renames a benefit, and the coverage row follows', async () => {
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

    await user.click(await screen.findByRole('button', { name: 'Edit Aurora Wellness Programme' }));
    const field = await screen.findByLabelText(/Benefit name/i);
    await user.clear(field);
    await user.type(field, 'Wellness Programme');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(store.options[0]?.name).toBe('Wellness Programme'));
    // The benefit is one record, so the row on the plan reads the new name.
    expect(await screen.findByLabelText('Wellness Programme value')).toBeInTheDocument();
  });

  it('renames a sub-benefit without touching its group', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    givenOption('option_group', 'Life & Accident Coverage');
    store.options[0]!.isUmbrella = true;
    store.options[0]!.fields = [];
    givenOption('option_death', 'Death (Natural)');
    store.options[1]!.parentId = 'option_group';

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: 'Edit Death (Natural)' }));
    const field = await screen.findByLabelText(/Benefit name/i);
    await user.clear(field);
    await user.type(field, 'Death by natural causes');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(store.options[1]?.name).toBe('Death by natural causes'));
    expect(store.options[0]?.name).toBe('Life & Accident Coverage');
    expect(store.options[1]?.parentId).toBe('option_group');
  });

  it('refuses to rename a benefit onto a name that already exists', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption('option_1', 'Optical');
    givenOption('option_2', 'Dental');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: 'Edit Optical' }));
    const field = await screen.findByLabelText(/Benefit name/i);
    await user.clear(field);
    await user.type(field, 'Dental');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(store.options[0]?.name).toBe('Optical');
  });

  it('deletes a benefit from the catalogue when nothing is using it', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(
      await screen.findByRole('button', { name: 'Delete Aurora Wellness Programme' }),
    );
    // The dialog says what this is, so it is not mistaken for "remove from this plan".
    expect(await screen.findByText(/catalogue for every company/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));

    await waitFor(() => expect(store.options).toHaveLength(0));
  });

  it('warns what a benefit in use takes with it, then deletes it everywhere', async () => {
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
    store.values.push({
      planOptionId: 'planOption_1',
      optionFieldId: 'option_1_percentage',
      value: 80,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(
      await screen.findByRole('button', { name: 'Delete Aurora Wellness Programme' }),
    );
    expect(await screen.findByText(/1 plan configuration that carries it/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Delete everywhere/i }));

    // The benefit, its attachment and its recorded value all go.
    await waitFor(() => expect(store.options).toHaveLength(0));
    expect(store.planOptions).toHaveLength(0);
    expect(store.values).toHaveLength(0);
  });

  it('deletes a single sub-benefit and leaves its group standing', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    givenOption('option_group', 'Life & Accident Coverage');
    store.options[0]!.isUmbrella = true;
    store.options[0]!.fields = [];
    givenOption('option_death', 'Death (Natural)');
    store.options[1]!.parentId = 'option_group';

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: 'Delete Death (Natural)' }));
    await user.click(await screen.findByRole('button', { name: /^Delete$/ }));

    await waitFor(() => expect(store.options).toHaveLength(1));
    expect(store.options[0]?.name).toBe('Life & Accident Coverage');
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
      // The inline box writes its own field: /plan-options/:id/values/:fieldId
      path: /^\/plan-options\/.+\/values\/.+$/,
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
    // A figure is entered through a text control so it can carry separators.
    expect(input).toHaveValue('90');
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
        {
          id: 'f_available',
          optionId: 'option_2',
          label: 'Available',
          key: 'available',
          dataType: 'BOOLEAN',
          unit: null,
          helpText: null,
          isRequired: false,
          sortOrder: 0,
          isActive: true,
          ...timestamps,
        },
        {
          id: 'f_provider',
          optionId: 'option_2',
          label: 'Provider',
          key: 'provider',
          dataType: 'TEXT',
          unit: null,
          helpText: null,
          isRequired: false,
          sortOrder: 1,
          isActive: true,
          ...timestamps,
        },
      ],
    });
    store.planOptions.push({
      id: 'planOption_2',
      planConfigurationId: configurationId,
      optionId: 'option_2',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    /**
     * Boolean renders as a Yes/No select, text as a text box — driven by
     * dataType, with no code knowing what either field means.
     *
     * Both are core fields, so both are visible at once and each saves itself;
     * the accessible name carries the benefit so thirty 'Coverage' boxes on one
     * screen stay tellable apart.
     */
    const available = await screen.findByLabelText('Zenith Travel Assistance Available value');
    expect(available.tagName).toBe('SELECT');
    expect(screen.getByLabelText('Zenith Travel Assistance Provider value').tagName).toBe('INPUT');

    await user.selectOptions(available, 'true');
    await user.type(
      screen.getByLabelText('Zenith Travel Assistance Provider value'),
      'Any network clinic',
    );

    // No Save button anywhere: each box goes on its own.
    expect(screen.queryByRole('button', { name: /^Save / })).not.toBeInTheDocument();
    await waitFor(() => expect(store.values).toHaveLength(2), { timeout: 4000 });
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
      {
        id: 'planOption_a',
        planConfigurationId: configurationId,
        optionId: 'option_1',
        sortOrder: 0,
      },
      {
        id: 'planOption_b',
        planConfigurationId: configurationId,
        optionId: 'option_2',
        sortOrder: 1,
      },
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

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Pre-existing & Chronic Conditions — one benefit, asked differently of each
// customer type
// ---------------------------------------------------------------------------

const PRE_EXISTING = 'Pre-existing & Chronic Conditions';

/**
 * The benefit as an employee defined it: two core fields the documents always
 * state, and five conditions they only sometimes do.
 *
 * COMPLETELY STRUCTURED. Not one free-text box and not one "Other" anywhere —
 * every answer is a currency, a number, a percentage, a dropdown, a
 * multi-select or a toggle, so thirty plans cannot describe one fact thirty
 * ways.
 *
 * `customerTypes: []` means everyone is asked. A non-empty list is what lets
 * ONE benefit ask Family and SME a question Individual never sees, without a
 * second benefit existing anywhere.
 */
function givenPreExistingBenefit() {
  const field = (
    key: string,
    label: string,
    dataType: OptionFieldDto['dataType'],
    extras: Partial<OptionFieldDto> = {},
  ): OptionFieldDto => ({
    id: `pre_${key}`,
    optionId: 'option_pre',
    label,
    key,
    dataType,
    unit: null,
    helpText: null,
    isRequired: false,
    sortOrder: 0,
    isActive: true,
    isOptional: false,
    parentFieldId: null,
    showWhenChoiceId: null,
    customerTypes: [],
    ...timestamps,
    ...extras,
  });

  /** A rule about a GROUP: an individual policy has none, so it is never asked. */
  const GROUPS: CustomerTypeId[] = ['FAMILY', 'SME'];

  store.options.push({
    id: 'option_pre',
    name: PRE_EXISTING,
    description: null,
    sortOrder: 0,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [
      // Core: stated as a matter of course, so always on screen.
      field('limit', 'Limit', 'CURRENCY', { sortOrder: 0 }),
      field('period', 'Period', 'RANK', { sortOrder: 1, isRequired: true }),

      // Conditions: a toggle each, asking nothing until switched on.
      field('co_payment', 'Co-payment', 'PERCENTAGE', {
        unit: '%',
        isOptional: true,
        sortOrder: 2,
      }),
      field('waiting_period', 'Waiting period', 'NUMBER', {
        unit: 'months',
        isOptional: true,
        sortOrder: 3,
      }),
      field('specific_conditions', 'Specific conditions', 'MULTI', {
        isOptional: true,
        sortOrder: 4,
      }),
      field('limit_applies_to', 'Limit applies to', 'RANK', { isOptional: true, sortOrder: 5 }),

      // Family and SME only, and its two boxes with it.
      field('member_ratio', 'Member ratio', 'BOOLEAN', {
        isOptional: true,
        sortOrder: 6,
        customerTypes: GROUPS,
      }),
      field('one_in', 'One in', 'NUMBER', {
        parentFieldId: 'pre_member_ratio',
        sortOrder: 0,
        customerTypes: GROUPS,
      }),
      field('members', 'Members', 'NUMBER', {
        parentFieldId: 'pre_member_ratio',
        sortOrder: 1,
        customerTypes: GROUPS,
      }),
    ],
  });

  ['Per year', 'Per policy year', 'Lifetime', 'Within annual limit'].forEach((label, index) =>
    givenAnswer(`choice_period_${index}`, 'pre_period', label, index),
  );

  ['Diabetes', 'Hypertension', 'Cancer', 'Hepatitis', 'Heart disease', 'Kidney disease'].forEach(
    (label, index) =>
      givenAnswer(`choice_condition_${index}`, 'pre_specific_conditions', label, index),
  );

  ['Per member', 'Per family', 'Per condition', 'Per year', 'Per policy year'].forEach(
    (label, index) => givenAnswer(`choice_applies_${index}`, 'pre_limit_applies_to', label, index),
  );

  return 'option_pre';
}

/** The benefit dragged onto one configuration, ready to be filled in. */
function givenPreExistingOnAPlan(customerType: CustomerTypeId = 'INDIVIDUAL') {
  givenCompany();
  givenInsuranceType();
  givenPlan();
  const configurationId = givenConfiguration('cfg_1', 'plan_1', customerType);
  givenPreExistingBenefit();
  store.planOptions.push({
    id: 'planOption_pre',
    planConfigurationId: configurationId,
    optionId: 'option_pre',
    sortOrder: 0,
  });
  return configurationId;
}

const valueOf = (fieldId: string) =>
  store.values.find((v) => v.planOptionId === 'planOption_pre' && v.optionFieldId === fieldId);

/** Every condition toggle the card offers, in the order it draws them. */
const conditionsOffered = () =>
  screen
    .queryAllByRole('checkbox')
    .map((box) => box.getAttribute('aria-label') ?? '')
    .filter((label) => label.endsWith(`for ${PRE_EXISTING}`))
    .map((label) => label.replace(` for ${PRE_EXISTING}`, ''));

describe('pre-existing and chronic conditions', () => {
  it('takes a limit as a currency figure, grouped as it is typed', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const limit = await screen.findByLabelText(`${PRE_EXISTING} Limit value`);
    await user.type(limit, '25000');
    await user.tab();

    // Read back grouped, stored plain.
    expect(limit).toHaveValue('25,000');
    await waitFor(() => expect(valueOf('pre_limit')?.value).toBe(25000));
  });

  it('asks for the period as a dropdown of four answers, with no Other', async () => {
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const period = await screen.findByLabelText(`${PRE_EXISTING} Period value`);
    expect(period.tagName).toBe('SELECT');
    expect(
      within(period)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Not specified', 'Per year', 'Per policy year', 'Lifetime', 'Within annual limit']);
    expect(screen.getByText('Period').textContent).toContain('*');
  });

  it('stores the chosen period as the answer’s id, never as typed words', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.selectOptions(
      await screen.findByLabelText(`${PRE_EXISTING} Period value`),
      'choice_period_0',
    );

    // The id of "Per year" — so one answer reads the same on every plan.
    await waitFor(() => expect(valueOf('pre_period')?.value).toBe('choice_period_0'));
  });

  it('offers not one free-text box and not one Other, anywhere', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan('SME');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${PRE_EXISTING} Limit value`);

    // Every condition open at once, so nothing hides behind a toggle.
    for (const condition of conditionsOffered()) {
      await user.click(screen.getByRole('checkbox', { name: `${condition} for ${PRE_EXISTING}` }));
    }
    await screen.findByLabelText(`${PRE_EXISTING} Co-payment value`);

    // Not one answer anywhere is "Other".
    expect(screen.queryByRole('option', { name: /^other$/i })).toBeNull();

    // Not one setting is defined as free text — including behind a toggle.
    expect((store.options[0]?.fields ?? []).filter((field) => field.dataType === 'TEXT')).toEqual(
      [],
    );

    /**
     * And nothing on screen accepts a sentence. A figure box is an
     * `<input type="text">` so it can group thousands as it is typed, so a
     * textbox is judged by what it accepts: a numeric keypad means a number.
     * Only the note — deliberately free — may take words.
     */
    const acceptsProse = screen
      .getAllByRole('textbox')
      .filter((box) => box.getAttribute('inputmode') !== 'decimal')
      .map((box) => box.getAttribute('aria-label') ?? '')
      .filter((label) => label.startsWith(PRE_EXISTING) && !label.endsWith('note'));
    expect(acceptsProse).toEqual([]);
  });

  it('hides co-payment until the document is said to mention it', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const toggle = await screen.findByRole('checkbox', { name: `Co-payment for ${PRE_EXISTING}` });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByLabelText(`${PRE_EXISTING} Co-payment value`)).toBeNull();

    await user.click(toggle);

    const percentage = await screen.findByLabelText(`${PRE_EXISTING} Co-payment value`);
    await user.type(percentage, '20');
    await user.tab();
    await waitFor(() => expect(valueOf('pre_co_payment')?.value).toBe(20));

    // Switching it off says the document never mentioned it — nothing remains.
    await user.click(toggle);
    await waitFor(() => expect(valueOf('pre_co_payment')).toBeUndefined());
    expect(screen.queryByLabelText(`${PRE_EXISTING} Co-payment value`)).toBeNull();
  });

  it('hides the waiting period until enabled, then counts it in months', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    expect(screen.queryByLabelText(`${PRE_EXISTING} Waiting period value`)).toBeNull();

    await user.click(
      await screen.findByRole('checkbox', { name: `Waiting period for ${PRE_EXISTING}` }),
    );

    const months = await screen.findByLabelText(`${PRE_EXISTING} Waiting period value`);
    await user.type(months, '10');
    await user.tab();
    await waitFor(() => expect(valueOf('pre_waiting_period')?.value).toBe(10));
    expect(screen.getByText('months')).toBeInTheDocument();
  });

  it('records several specific conditions, each its own value', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(
      await screen.findByRole('checkbox', { name: `Specific conditions for ${PRE_EXISTING}` }),
    );
    await user.click(
      await screen.findByRole('button', { name: `Specific conditions for ${PRE_EXISTING}` }),
    );

    // Six named conditions to pick from, and no box to type a seventh into.
    expect(
      store.choices.filter((choice) => choice.optionFieldId === 'pre_specific_conditions'),
    ).toHaveLength(6);

    await user.click(await screen.findByRole('checkbox', { name: 'Diabetes' }));
    await user.click(screen.getByRole('checkbox', { name: 'Hypertension' }));
    await user.click(screen.getByRole('checkbox', { name: 'Kidney disease' }));

    // Three separate answers, not one sentence — a report can count them.
    await waitFor(() =>
      expect(
        store.planOptions.find((item) => item.id === 'planOption_pre')?.tickedChoiceIds,
      ).toEqual(['choice_condition_0', 'choice_condition_1', 'choice_condition_5']),
    );
  });

  it('offers Limit applies to as a dropdown of five answers', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(
      await screen.findByRole('checkbox', { name: `Limit applies to for ${PRE_EXISTING}` }),
    );

    const applies = await screen.findByLabelText(`${PRE_EXISTING} Limit applies to value`);
    expect(applies.tagName).toBe('SELECT');
    expect(
      within(applies)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Not specified',
      'Per member',
      'Per family',
      'Per condition',
      'Per year',
      'Per policy year',
    ]);

    await user.selectOptions(applies, 'choice_applies_1');
    await waitFor(() => expect(valueOf('pre_limit_applies_to')?.value).toBe('choice_applies_1'));
  });

  it('leaves untouched fields EMPTY, and never turns them into zero', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    // Nothing entered: the benefit is on the plan and says nothing else.
    expect(await screen.findByLabelText(`${PRE_EXISTING} Limit value`)).toHaveValue('');
    expect(store.values).toHaveLength(0);

    // Switching a condition on without a figure is a real answer: it applies,
    // the amount was not stated. The row exists; its value stays null.
    await user.click(
      await screen.findByRole('checkbox', { name: `Co-payment for ${PRE_EXISTING}` }),
    );
    await waitFor(() => expect(valueOf('pre_co_payment')).toBeDefined());
    expect(valueOf('pre_co_payment')?.value).toBeNull();
    expect(await screen.findByLabelText(`${PRE_EXISTING} Co-payment value`)).toHaveValue('');

    // And a stated zero is still recorded as zero.
    await user.type(screen.getByLabelText(`${PRE_EXISTING} Limit value`), '0');
    await user.tab();
    await waitFor(() => expect(valueOf('pre_limit')?.value).toBe(0));
  });

  // -------------------------------------------------------------------------
  // ONE benefit, asked differently of each customer type
  // -------------------------------------------------------------------------

  it('never asks an individual plan for a member ratio', async () => {
    const configurationId = givenPreExistingOnAPlan('INDIVIDUAL');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${PRE_EXISTING} Limit value`);

    // Four conditions, and Member ratio is not among them — an individual
    // policy has no group, so the question is not put at all.
    expect(conditionsOffered()).toEqual([
      'Co-payment',
      'Waiting period',
      'Specific conditions',
      'Limit applies to',
    ]);
    expect(screen.queryByRole('checkbox', { name: /Member ratio/i })).toBeNull();
    // Not hidden behind a toggle either: its boxes do not exist on this plan.
    expect(screen.queryByLabelText(`${PRE_EXISTING} One in value`)).toBeNull();
    expect(screen.queryByLabelText(`${PRE_EXISTING} Members value`)).toBeNull();
  });

  it.each([
    ['FAMILY' as CustomerTypeId, '10'],
    ['SME' as CustomerTypeId, '20'],
  ])('asks a %s plan for a member ratio, as two numbers', async (customerType, oneIn) => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan(customerType);

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${PRE_EXISTING} Limit value`);

    expect(conditionsOffered()).toEqual([
      'Co-payment',
      'Waiting period',
      'Specific conditions',
      'Limit applies to',
      'Member ratio',
    ]);

    await user.click(screen.getByRole('checkbox', { name: `Member ratio for ${PRE_EXISTING}` }));

    // "One in 10 members" — two figures a report can compare, not a sentence.
    await user.type(await screen.findByLabelText(`${PRE_EXISTING} One in value`), oneIn);
    await user.tab();
    await user.type(screen.getByLabelText(`${PRE_EXISTING} Members value`), '1');
    await user.tab();

    await waitFor(() => expect(valueOf('pre_one_in')?.value).toBe(Number(oneIn)));
    expect(valueOf('pre_members')?.value).toBe(1);

    // The toggle is the yes/no, so the condition itself asks nothing further.
    expect(screen.queryByLabelText(`${PRE_EXISTING} Member ratio value`)).toBeNull();
  });

  it('is one benefit, not one per customer type', async () => {
    const first = renderApp(
      ROUTES.configurations.detail('company_1', 'plan_1', givenPreExistingOnAPlan('INDIVIDUAL')),
    );
    await screen.findByLabelText(`${PRE_EXISTING} Limit value`);
    expect(conditionsOffered()).toHaveLength(4);
    first.unmount();

    // The SME configuration of the SAME plan asks one question more, and every
    // question they share is the same field — no second benefit exists.
    const configurationId = givenConfiguration('cfg_sme', 'plan_1', 'SME');
    store.planOptions.push({
      id: 'planOption_pre',
      planConfigurationId: configurationId,
      optionId: 'option_pre',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${PRE_EXISTING} Limit value`);
    expect(conditionsOffered()).toHaveLength(5);

    expect(store.options).toHaveLength(1);
    expect(store.options[0]?.fields).toHaveLength(9);
  });
});

describe('a multi-select shows its answers as answers', () => {
  it('renders each ticked answer separately, never as one joined sentence', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption('option_1', 'Inpatient & Daycase');
    const fieldId = givenMultiSetting('option_1', 'Included services');
    ['Operating room', 'Surgeon fees', 'ICU', 'Room & board'].forEach((label, index) =>
      givenAnswer(`svc_${index}`, fieldId, label, index),
    );
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
      tickedChoiceIds: ['svc_0', 'svc_1', 'svc_2', 'svc_3'],
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const control = await screen.findByRole('button', {
      name: 'Included services for Inpatient & Daycase',
    });

    /**
     * Four facts, four elements. Joined into "Operating room · Surgeon fees ·
     * ICU · Room & board" they would read as one vague remark and truncate into
     * nonsense — and what is stored is four separate answers.
     */
    const shown = within(control)
      .getAllByText(/Operating room|Surgeon fees|ICU|Room & board/)
      .map((chip) => chip.textContent);
    expect(shown).toEqual(['Operating room', 'Surgeon fees', 'ICU', 'Room & board']);

    // Each answer stays individually ticked and individually removable.
    await user.click(control);
    const services = await screen.findByRole('checkbox', { name: 'Surgeon fees' });
    expect(services).toBeChecked();
    await user.click(services);
    await waitFor(() =>
      expect(store.planOptions[0]?.tickedChoiceIds).toEqual(['svc_0', 'svc_2', 'svc_3']),
    );
  });

  it('says nothing was recorded rather than inventing a summary', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption('option_1', 'Inpatient & Daycase');
    givenMultiSetting('option_1', 'Included services');
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    // Unspecified stays unspecified — no "Includes: …" sentence is generated.
    const control = await screen.findByRole('button', {
      name: 'Included services for Inpatient & Daycase',
    });
    expect(control.textContent).toBe('+ Included services');
  });
});

describe('a condition does not say its own name twice', () => {
  it('labels an enabled condition once — on its checkbox, not again on its box', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(
      await screen.findByRole('checkbox', { name: `Limit applies to for ${PRE_EXISTING}` }),
    );
    await screen.findByLabelText(`${PRE_EXISTING} Limit applies to value`);

    // The checkbox names the condition. The control under it needs no caption
    // of its own — repeating it reads as two separate things.
    expect(screen.getAllByText('Limit applies to')).toHaveLength(1);
  });

  it('still labels each box of a condition that asks for more than one', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan('FAMILY');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await user.click(
      await screen.findByRole('checkbox', { name: `Member ratio for ${PRE_EXISTING}` }),
    );

    // "One in [ ] Members" — two boxes that must each say which is which.
    expect(await screen.findByText('One in')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getAllByText('Member ratio')).toHaveLength(1);
  });
});

describe('a dropdown inside a condition is not cut off', () => {
  it('stops clipping the reveal once it has finished opening', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const toggle = await screen.findByRole('checkbox', {
      name: `Specific conditions for ${PRE_EXISTING}`,
    });
    await user.click(toggle);

    const control = await screen.findByRole('button', {
      name: `Specific conditions for ${PRE_EXISTING}`,
    });

    /**
     * The reveal clips its content while it grows, or the row spills out at
     * half height. A dropdown opens BELOW its control, so a clip that outlived
     * the animation cut the panel off and the answers could not be reached.
     */
    const clip = control.closest('.overflow-hidden, .overflow-visible');
    await waitFor(() => expect(clip).toHaveClass('overflow-visible'));

    // And the answers are reachable and tickable.
    await user.click(control);
    await user.click(await screen.findByRole('checkbox', { name: 'Kidney disease' }));
    await waitFor(() =>
      expect(
        store.planOptions.find((item) => item.id === 'planOption_pre')?.tickedChoiceIds,
      ).toEqual(['choice_condition_5']),
    );
  });

  it('clips again when the condition is switched off', async () => {
    const user = userEvent.setup();
    const configurationId = givenPreExistingOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    const toggle = await screen.findByRole('checkbox', {
      name: `Specific conditions for ${PRE_EXISTING}`,
    });

    await user.click(toggle);
    const control = await screen.findByRole('button', {
      name: `Specific conditions for ${PRE_EXISTING}`,
    });
    const clip = control.closest('.overflow-hidden, .overflow-visible');
    await waitFor(() => expect(clip).toHaveClass('overflow-visible'));

    // Collapsing must clip immediately, so nothing shows through a closed row.
    await user.click(toggle);
    await waitFor(() => expect(clip).toHaveClass('overflow-hidden'));
  });
});

// ---------------------------------------------------------------------------
// Maternity — the same benefit, asked differently of each customer type
// ---------------------------------------------------------------------------

const MATERNITY = 'Maternity Details';

/** Mirrors the definition held in Railway production, field for field. */
function givenMaternityOnAPlan(customerType: CustomerTypeId) {
  givenCompany();
  givenInsuranceType();
  givenPlan();
  const configurationId = givenConfiguration('cfg_1', 'plan_1', customerType);

  const field = (
    key: string,
    label: string,
    dataType: OptionFieldDto['dataType'],
    extras: Partial<OptionFieldDto> = {},
  ): OptionFieldDto => ({
    id: `mat_${key}`,
    optionId: 'option_mat',
    label,
    key,
    dataType,
    unit: null,
    helpText: null,
    isRequired: false,
    sortOrder: 0,
    isActive: true,
    isOptional: false,
    parentFieldId: null,
    showWhenChoiceId: null,
    customerTypes: [],
    ...timestamps,
    ...extras,
  });

  const GROUPS: CustomerTypeId[] = ['FAMILY', 'SME'];

  store.options.push({
    id: 'option_mat',
    name: MATERNITY,
    description: null,
    sortOrder: 0,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [
      field('limit', 'Maternity Limit', 'CURRENCY', { sortOrder: 0 }),
      field('coverage', 'Coverage', 'PERCENTAGE', { unit: '%', sortOrder: 1 }),
      field('co_payment', 'Co-payment', 'PERCENTAGE', {
        unit: '%',
        isOptional: true,
        sortOrder: 2,
      }),
      field('delivery_type', 'Delivery type', 'MULTI', { isOptional: true, sortOrder: 3 }),
      field('waiting_period', 'Waiting period', 'NUMBER', {
        unit: 'months',
        isOptional: true,
        sortOrder: 4,
      }),
      field('pregnancy_before_policy', 'Pregnancy before policy', 'BOOLEAN', {
        isOptional: true,
        sortOrder: 5,
      }),
      field('member_ratio', 'Member ratio', 'BOOLEAN', {
        isOptional: true,
        sortOrder: 6,
        customerTypes: GROUPS,
      }),
      field('one_in', 'One in', 'NUMBER', {
        parentFieldId: 'mat_member_ratio',
        sortOrder: 0,
        customerTypes: GROUPS,
      }),
      field('members', 'Members', 'NUMBER', {
        parentFieldId: 'mat_member_ratio',
        sortOrder: 1,
        customerTypes: GROUPS,
      }),
    ],
  });

  ['Normal delivery', 'Caesarean section'].forEach((label, index) =>
    givenAnswer(`delivery_${index}`, 'mat_delivery_type', label, index),
  );

  store.planOptions.push({
    id: 'planOption_mat',
    planConfigurationId: configurationId,
    optionId: 'option_mat',
    sortOrder: 0,
  });
  return configurationId;
}

const maternityConditions = () =>
  screen
    .queryAllByRole('checkbox')
    .map((box) => box.getAttribute('aria-label') ?? '')
    .filter((label) => label.endsWith(`for ${MATERNITY}`))
    .map((label) => label.replace(` for ${MATERNITY}`, ''));

describe('maternity', () => {
  it('asks an Individual plan for everything EXCEPT a member ratio', async () => {
    const configurationId = givenMaternityOnAPlan('INDIVIDUAL');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${MATERNITY} Maternity Limit value`);
    expect(screen.getByLabelText(`${MATERNITY} Coverage value`)).toBeInTheDocument();

    expect(maternityConditions()).toEqual([
      'Co-payment',
      'Delivery type',
      'Waiting period',
      'Pregnancy before policy',
    ]);

    // An individual policy has no group. Not disabled, not greyed — absent.
    expect(screen.queryByRole('checkbox', { name: /Member ratio/i })).toBeNull();
    expect(screen.queryByLabelText(`${MATERNITY} One in value`)).toBeNull();
    expect(screen.queryByLabelText(`${MATERNITY} Members value`)).toBeNull();
  });

  it.each([['FAMILY' as CustomerTypeId], ['SME' as CustomerTypeId]])(
    'asks a %s plan for a member ratio, as two numbers it enters itself',
    async (customerType) => {
      const user = userEvent.setup();
      const configurationId = givenMaternityOnAPlan(customerType);

      renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
      await screen.findByLabelText(`${MATERNITY} Maternity Limit value`);

      expect(maternityConditions()).toEqual([
        'Co-payment',
        'Delivery type',
        'Waiting period',
        'Pregnancy before policy',
        'Member ratio',
      ]);

      await user.click(screen.getByRole('checkbox', { name: `Member ratio for ${MATERNITY}` }));

      // "One in 20 members" — whatever this document says, not a fixed ratio.
      const oneIn = await screen.findByLabelText(`${MATERNITY} One in value`);
      await user.type(oneIn, '20');
      await user.tab();
      await waitFor(() =>
        expect(store.values.find((v) => v.optionFieldId === 'mat_one_in')?.value).toBe(20),
      );
    },
  );

  it('offers the delivery kinds as answers, and no figure as an answer', async () => {
    const user = userEvent.setup();
    const configurationId = givenMaternityOnAPlan('INDIVIDUAL');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${MATERNITY} Maternity Limit value`);

    await user.click(screen.getByRole('checkbox', { name: `Delivery type for ${MATERNITY}` }));
    await user.click(await screen.findByRole('button', { name: `Delivery type for ${MATERNITY}` }));

    expect(
      (await screen.findAllByRole('checkbox'))
        .map((box) => box.getAttribute('aria-label') ?? box.parentElement?.textContent ?? '')
        .filter((label) => /delivery|Caesarean/i.test(label) && !label.includes('for ')),
    ).toEqual(['Normal delivery', 'Caesarean section']);

    // Not one amount, percentage or duration is offered as a pickable answer.
    const numeric = (store.options[0]?.fields ?? []).filter((f) =>
      ['CURRENCY', 'PERCENTAGE', 'NUMBER'].includes(f.dataType),
    );
    // Limit, Coverage, Co-payment, Waiting period, One in, Members.
    expect(numeric.map((f) => f.label)).toHaveLength(6);
    for (const f of numeric) {
      expect(store.choices.filter((c) => c.optionFieldId === f.id)).toEqual([]);
    }
  });

  it('leaves an untouched maternity limit empty, and keeps a stated zero', async () => {
    const user = userEvent.setup();
    const configurationId = givenMaternityOnAPlan('INDIVIDUAL');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const limit = await screen.findByLabelText(`${MATERNITY} Maternity Limit value`);
    expect(limit).toHaveValue('');
    expect(store.values).toHaveLength(0);

    await user.type(limit, '0');
    await user.tab();
    await waitFor(() =>
      expect(store.values.find((v) => v.optionFieldId === 'mat_limit')?.value).toBe(0),
    );
  });
});

describe('maternity: pregnancy before the policy started', () => {
  it('is off by default, and ticking it IS the yes', async () => {
    const user = userEvent.setup();
    const configurationId = givenMaternityOnAPlan('INDIVIDUAL');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${MATERNITY} Maternity Limit value`);

    const toggle = screen.getByRole('checkbox', {
      name: `Pregnancy before policy for ${MATERNITY}`,
    });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByLabelText(`${MATERNITY} Pregnancy before policy value`)).toBeNull();

    await user.click(toggle);

    /**
     * TICKING IT IS THE ANSWER — the row exists, so the cover applies.
     *
     * A Yes/No underneath would ask the same question twice, and leave a
     * ticked box reading "Not set", which says nothing at all.
     */
    await waitFor(() => expect(toggle).toBeChecked());
    await waitFor(() =>
      expect(
        store.values.find((v) => v.optionFieldId === 'mat_pregnancy_before_policy'),
      ).toBeDefined(),
    );
    expect(screen.queryByLabelText(`${MATERNITY} Pregnancy before policy value`)).toBeNull();
    // Nothing to pick and nothing to type — the checkbox said it all.
    expect(screen.queryByRole('option', { name: 'Not specified' })).toBeNull();

    // Switching it off says the document never mentioned it — nothing remains.
    await user.click(toggle);
    await waitFor(() =>
      expect(
        store.values.find((v) => v.optionFieldId === 'mat_pregnancy_before_policy'),
      ).toBeUndefined(),
    );
  });

  it('is asked of every customer type, unlike the member ratio', async () => {
    const individual = renderApp(
      ROUTES.configurations.detail('company_1', 'plan_1', givenMaternityOnAPlan('INDIVIDUAL')),
    );
    await screen.findByLabelText(`${MATERNITY} Maternity Limit value`);
    expect(maternityConditions()).toContain('Pregnancy before policy');
    expect(maternityConditions()).not.toContain('Member ratio');
    individual.unmount();

    // The SME configuration of the SAME plan, holding the SAME benefit.
    const sme = givenConfiguration('cfg_sme', 'plan_1', 'SME');
    store.planOptions.push({
      id: 'planOption_mat',
      planConfigurationId: sme,
      optionId: 'option_mat',
      sortOrder: 0,
    });

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', sme));
    await screen.findByLabelText(`${MATERNITY} Maternity Limit value`);
    expect(maternityConditions()).toContain('Pregnancy before policy');
    expect(maternityConditions()).toContain('Member ratio');

    // One benefit, asked differently — not a second maternity benefit.
    expect(store.options).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Optical — every customer type, no member ratio
// ---------------------------------------------------------------------------

const OPTICAL = 'Optical Details';
const FREQUENCY = [
  'Once per year',
  'Once every 2 years',
  'Once every 3 years',
  'Once per policy period',
];

/** Mirrors the definition held in Railway production, field for field. */
function givenOpticalOnAPlan(customerType: CustomerTypeId = 'INDIVIDUAL') {
  givenCompany();
  givenInsuranceType();
  givenPlan();
  const configurationId = givenConfiguration('cfg_1', 'plan_1', customerType);

  const field = (
    key: string,
    label: string,
    dataType: OptionFieldDto['dataType'],
    extras: Partial<OptionFieldDto> = {},
  ): OptionFieldDto => ({
    id: `opt_${key}`,
    optionId: 'option_opt',
    label,
    key,
    dataType,
    unit: null,
    helpText: null,
    isRequired: false,
    sortOrder: 0,
    isActive: true,
    isOptional: false,
    parentFieldId: null,
    showWhenChoiceId: null,
    customerTypes: [],
    ...timestamps,
    ...extras,
  });

  store.options.push({
    id: 'option_opt',
    name: OPTICAL,
    description: null,
    sortOrder: 0,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [
      field('limit', 'Optical Limit', 'CURRENCY', { sortOrder: 0 }),
      field('coverage', 'Coverage', 'PERCENTAGE', { unit: '%', sortOrder: 1 }),
      field('co_payment', 'Co-payment', 'PERCENTAGE', {
        unit: '%',
        isOptional: true,
        sortOrder: 2,
      }),
      field('eye_test', 'Eye test', 'RANK', { isOptional: true, sortOrder: 3 }),
      field('glasses', 'Glasses', 'RANK', { isOptional: true, sortOrder: 4 }),
      field('contact_lenses', 'Contact lenses', 'RANK', { isOptional: true, sortOrder: 5 }),
      field('network', 'Network', 'RANK', { isOptional: true, sortOrder: 6 }),
      // A list the employee writes, ticks and ranks — nothing predefined.
      field('provider_restriction', 'Provider restriction', 'MULTI', {
        isOptional: true,
        sortOrder: 7,
      }),
    ],
  });

  // Each setting owns its own list: how often glasses are replaced is not an
  // answer about eye tests.
  for (const key of ['eye_test', 'glasses', 'contact_lenses']) {
    FREQUENCY.forEach((label, index) => givenAnswer(`${key}_${index}`, `opt_${key}`, label, index));
  }
  ['In-network only', 'In-network and out-of-network', 'Out-of-network only'].forEach(
    (label, index) => givenAnswer(`opt_net_${index}`, 'opt_network', label, index),
  );

  store.planOptions.push({
    id: 'planOption_opt',
    planConfigurationId: configurationId,
    optionId: 'option_opt',
    sortOrder: 0,
  });
  return configurationId;
}

const opticalConditions = () =>
  screen
    .queryAllByRole('checkbox')
    .map((box) => box.getAttribute('aria-label') ?? '')
    .filter((label) => label.endsWith(`for ${OPTICAL}`))
    .map((label) => label.replace(` for ${OPTICAL}`, ''));

describe('optical', () => {
  it.each([
    ['INDIVIDUAL' as CustomerTypeId],
    ['FAMILY' as CustomerTypeId],
    ['SME' as CustomerTypeId],
  ])('asks a %s plan the same six conditions, and never a member ratio', async (customerType) => {
    const configurationId = givenOpticalOnAPlan(customerType);

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${OPTICAL} Optical Limit value`);
    expect(screen.getByLabelText(`${OPTICAL} Coverage value`)).toBeInTheDocument();

    // Optical is a rule about a person, not about a group — every buyer is
    // asked the same thing, and no ratio question exists here at all.
    expect(opticalConditions()).toEqual([
      'Co-payment',
      'Eye test',
      'Glasses',
      'Contact lenses',
      'Network',
      'Provider restriction',
    ]);
    expect(screen.queryByRole('checkbox', { name: /Member ratio/i })).toBeNull();
  });

  it.each([['Eye test'], ['Glasses'], ['Contact lenses']])(
    'reveals a frequency dropdown for %s, defaulting to nothing',
    async (condition) => {
      const user = userEvent.setup();
      const configurationId = givenOpticalOnAPlan();

      renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
      await screen.findByLabelText(`${OPTICAL} Optical Limit value`);

      expect(screen.queryByLabelText(`${OPTICAL} ${condition} value`)).toBeNull();
      await user.click(screen.getByRole('checkbox', { name: `${condition} for ${OPTICAL}` }));

      const control = await screen.findByLabelText(`${OPTICAL} ${condition} value`);
      expect(control.tagName).toBe('SELECT');
      expect(
        within(control)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Not specified', ...FREQUENCY]);
      // No frequency is assumed — the document decides.
      expect(control).toHaveValue('');
    },
  );

  it('records the network scope as a chosen answer, never as typed words', async () => {
    const user = userEvent.setup();
    const configurationId = givenOpticalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${OPTICAL} Optical Limit value`);

    await user.click(screen.getByRole('checkbox', { name: `Network for ${OPTICAL}` }));
    const network = await screen.findByLabelText(`${OPTICAL} Network value`);
    await user.selectOptions(network, 'opt_net_0');

    await waitFor(() =>
      expect(store.values.find((v) => v.optionFieldId === 'opt_network')?.value).toBe('opt_net_0'),
    );
  });

  it('offers no figure as a pickable answer, and keeps empty empty', async () => {
    const user = userEvent.setup();
    const configurationId = givenOpticalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const limit = await screen.findByLabelText(`${OPTICAL} Optical Limit value`);
    expect(limit).toHaveValue('');
    expect(store.values).toHaveLength(0);

    // Not one amount or percentage is offered as an answer to pick.
    for (const f of (store.options[0]?.fields ?? []).filter((field) =>
      ['CURRENCY', 'PERCENTAGE', 'NUMBER'].includes(field.dataType),
    )) {
      expect(store.choices.filter((c) => c.optionFieldId === f.id)).toEqual([]);
    }

    // A stated zero is still a real answer.
    await user.type(limit, '0');
    await user.tab();
    await waitFor(() =>
      expect(store.values.find((v) => v.optionFieldId === 'opt_limit')?.value).toBe(0),
    );
  });
});

// ---------------------------------------------------------------------------
// Optical — provider restrictions the employee writes, ticks and ranks
// ---------------------------------------------------------------------------

/** Open the restriction editor: tick the condition, then open its list. */
async function openProviderRestrictions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: `Provider restriction for ${OPTICAL}` }));
  await user.click(
    await screen.findByRole('button', { name: `Provider restriction for ${OPTICAL}` }),
  );
}

/** Write a restriction of the employee's own wording. */
async function addRestriction(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(await screen.findByLabelText('New answer'), name);
  await user.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(store.choices.some((choice) => choice.label === name)).toBe(true));
}

const restrictionsOnThePlan = () =>
  store.planOptions.find((item) => item.id === 'planOption_opt')?.tickedChoiceIds ?? [];

const restrictionsDefined = () =>
  store.choices
    .filter((choice) => choice.optionFieldId === 'opt_provider_restriction')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((choice) => choice.label);

describe('optical: provider restrictions', () => {
  it('shows nothing until the condition is ticked', async () => {
    const user = userEvent.setup();
    const configurationId = givenOpticalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${OPTICAL} Optical Limit value`);

    const toggle = screen.getByRole('checkbox', { name: `Provider restriction for ${OPTICAL}` });
    expect(toggle).not.toBeChecked();
    expect(
      screen.queryByRole('button', { name: `Provider restriction for ${OPTICAL}` }),
    ).toBeNull();

    await user.click(toggle);

    // Ticked: the editor appears, offering nothing until the employee writes it.
    expect(
      await screen.findByRole('button', { name: `Provider restriction for ${OPTICAL}` }),
    ).toBeInTheDocument();
    expect(restrictionsDefined()).toEqual([]);
  });

  it('lets the employee write as many restrictions as the document needs', async () => {
    const user = userEvent.setup();
    const configurationId = givenOpticalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${OPTICAL} Optical Limit value`);
    await openProviderRestrictions(user);

    // Wording the employee chose, not a list anybody shipped.
    await addRestriction(user, 'Approved optical providers');
    await addRestriction(user, 'Network optical providers');
    await addRestriction(user, 'Named optical providers');

    expect(restrictionsDefined()).toEqual([
      'Approved optical providers',
      'Network optical providers',
      'Named optical providers',
    ]);
  });

  it('ticks one, then several, and leaves the rest available but unticked', async () => {
    const user = userEvent.setup();
    const configurationId = givenOpticalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${OPTICAL} Optical Limit value`);
    await openProviderRestrictions(user);

    await addRestriction(user, 'Approved optical providers');
    await addRestriction(user, 'Network optical providers');
    await addRestriction(user, 'Named optical providers');

    /**
     * Writing one down ticks it: an employee who typed it plainly meant it to
     * apply. So the second is untied here to prove ticking is separate from
     * existing — it stays on the list, simply not claimed by this plan.
     */
    await user.click(screen.getByRole('checkbox', { name: 'Network optical providers' }));

    await waitFor(() => expect(restrictionsOnThePlan()).toHaveLength(2));
    const ticked = new Set(restrictionsOnThePlan());
    const byLabel = Object.fromEntries(store.choices.map((choice) => [choice.label, choice.id]));
    expect(ticked.has(byLabel['Approved optical providers']!)).toBe(true);
    expect(ticked.has(byLabel['Named optical providers']!)).toBe(true);
    // Available to any plan, claimed by this one: no.
    expect(ticked.has(byLabel['Network optical providers']!)).toBe(false);
    expect(restrictionsDefined()).toHaveLength(3);

    // And an unticked one can be claimed later without being re-typed.
    await user.click(screen.getByRole('checkbox', { name: 'Network optical providers' }));
    await waitFor(() => expect(restrictionsOnThePlan()).toHaveLength(3));
  });

  it('ranks the restrictions by drag, without changing what is ticked', async () => {
    const user = userEvent.setup();
    const configurationId = givenOpticalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${OPTICAL} Optical Limit value`);
    await openProviderRestrictions(user);

    await addRestriction(user, 'Approved optical providers');
    await addRestriction(user, 'Named optical providers');
    await waitFor(() => expect(restrictionsOnThePlan()).toHaveLength(2));
    const tickedBefore = [...restrictionsOnThePlan()];

    // Ranking is a separate job from ticking, so it has its own mode.
    await user.click(screen.getByRole('button', { name: 'Rank & edit' }));
    expect(
      await screen.findByRole('button', { name: 'Reorder Approved optical providers' }),
    ).toBeInTheDocument();

    // jsdom reports zero-sized rects, so dnd-kit cannot resolve a pointer drop
    // target. The endpoint the list calls on drop is exercised directly.
    const ids = store.choices
      .filter((c) => c.optionFieldId === 'opt_provider_restriction')
      .map((c) => c.id);
    await fetch(`/api/v1/option-fields/opt_provider_restriction/choices/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedIds: [ids[1], ids[0]] }),
    });

    expect(restrictionsDefined()).toEqual([
      'Named optical providers',
      'Approved optical providers',
    ]);
    // Re-ranking says what each is worth. It says nothing about this plan.
    expect(restrictionsOnThePlan().sort()).toEqual(tickedBefore.sort());
  });

  it('removes a restriction that was written by mistake', async () => {
    const user = userEvent.setup();
    // Deleting an answer a plan records changes what that plan says, so the
    // API refuses and the employee is asked first.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const configurationId = givenOpticalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${OPTICAL} Optical Limit value`);
    await openProviderRestrictions(user);

    await addRestriction(user, 'Approved optical providers');
    await addRestriction(user, 'Naemd optical providers');

    await user.click(screen.getByRole('button', { name: 'Rank & edit' }));

    // Renaming corrects a typo everywhere at once.
    await user.click(await screen.findByRole('button', { name: 'Edit Naemd optical providers' }));
    const input = await screen.findByLabelText('Rename Naemd optical providers');
    await user.clear(input);
    await user.type(input, 'Named optical providers{Enter}');
    await waitFor(() => expect(restrictionsDefined()).toContain('Named optical providers'));

    await user.click(await screen.findByRole('button', { name: 'Delete Named optical providers' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await waitFor(() => expect(restrictionsDefined()).toEqual(['Approved optical providers']));
    // Gone from the list, and gone from the plan that claimed it.
    expect(restrictionsOnThePlan()).toHaveLength(1);
    confirm.mockRestore();
  });

  it('switching the condition off clears the plan’s claims but keeps the list', async () => {
    const user = userEvent.setup();
    const configurationId = givenOpticalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${OPTICAL} Optical Limit value`);
    await openProviderRestrictions(user);
    await addRestriction(user, 'Approved optical providers');
    await waitFor(() => expect(restrictionsOnThePlan()).toHaveLength(1));

    await user.click(screen.getByRole('checkbox', { name: `Provider restriction for ${OPTICAL}` }));

    // The document never mentioned it, so this plan claims nothing — but the
    // wording stays on the list for every other plan that does.
    await waitFor(() => expect(restrictionsOnThePlan()).toHaveLength(0));
    expect(restrictionsDefined()).toEqual(['Approved optical providers']);
  });
});

// ---------------------------------------------------------------------------
// Dental — two figures the documents always state, five conditions they may
// ---------------------------------------------------------------------------

const DENTAL = 'Dental Details';

/** Mirrors the definition held in Railway production, field for field. */
function givenDentalOnAPlan(customerType: CustomerTypeId = 'INDIVIDUAL') {
  givenCompany();
  givenInsuranceType();
  givenPlan();
  const configurationId = givenConfiguration('cfg_1', 'plan_1', customerType);

  const field = (
    key: string,
    label: string,
    dataType: OptionFieldDto['dataType'],
    extras: Partial<OptionFieldDto> = {},
  ): OptionFieldDto => ({
    id: `den_${key}`,
    optionId: 'option_den',
    label,
    key,
    dataType,
    unit: null,
    helpText: null,
    isRequired: false,
    sortOrder: 0,
    isActive: true,
    isOptional: false,
    parentFieldId: null,
    showWhenChoiceId: null,
    customerTypes: [],
    ...timestamps,
    ...extras,
  });

  store.options.push({
    id: 'option_den',
    name: DENTAL,
    description: null,
    sortOrder: 0,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [
      field('limit', 'Dental Limit', 'CURRENCY', { sortOrder: 0 }),
      /**
       * A core field in its own right, not an "or". It was once keyed
       * `alternative` — the legacy way of quoting a benefit two ways — and
       * while it was, the card read the two figures as "1,500 or 80%".
       */
      field('coverage', 'Coverage', 'PERCENTAGE', { unit: '%', sortOrder: 1 }),
      field('co_payment', 'Co-payment', 'PERCENTAGE', {
        unit: '%',
        isOptional: true,
        sortOrder: 2,
      }),
      field('dental_network', 'Dental Network', 'RANK', { isOptional: true, sortOrder: 3 }),
      field('included_services', 'Included Dental Services', 'MULTI', {
        isOptional: true,
        sortOrder: 4,
      }),
      field('waiting_period', 'Waiting period', 'NUMBER', {
        unit: 'months',
        isOptional: true,
        sortOrder: 5,
      }),
      field('frequency', 'Frequency', 'RANK', { isOptional: true, sortOrder: 6 }),
    ],
  });

  ['In-network only', 'In-network and out-of-network', 'Out-of-network only'].forEach(
    (label, index) => givenAnswer(`den_net_${index}`, 'den_dental_network', label, index),
  );
  ['Once per year', 'Once every 2 years', 'Once every 3 years', 'Once per policy period'].forEach(
    (label, index) => givenAnswer(`den_freq_${index}`, 'den_frequency', label, index),
  );

  store.planOptions.push({
    id: 'planOption_den',
    planConfigurationId: configurationId,
    optionId: 'option_den',
    sortOrder: 0,
  });
  return configurationId;
}

const dentalConditions = () =>
  screen
    .queryAllByRole('checkbox')
    .map((box) => box.getAttribute('aria-label') ?? '')
    .filter((label) => label.endsWith(`for ${DENTAL}`))
    .map((label) => label.replace(` for ${DENTAL}`, ''));

describe('dental', () => {
  it.each([
    ['INDIVIDUAL' as CustomerTypeId],
    ['FAMILY' as CustomerTypeId],
    ['SME' as CustomerTypeId],
  ])('asks a %s plan the same five conditions, and never a member ratio', async (customerType) => {
    const configurationId = givenDentalOnAPlan(customerType);

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${DENTAL} Dental Limit value`);
    expect(screen.getByLabelText(`${DENTAL} Coverage value`)).toBeInTheDocument();

    // Dental states a limit and a share of the cost; nothing about a group.
    expect(dentalConditions()).toEqual([
      'Co-payment',
      'Dental Network',
      'Included Dental Services',
      'Waiting period',
      'Frequency',
    ]);
    expect(screen.queryByRole('checkbox', { name: /Member ratio/i })).toBeNull();
  });

  it('takes the limit and the coverage as figures the employee types', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const limit = await screen.findByLabelText(`${DENTAL} Dental Limit value`);
    await user.type(limit, '600');
    await user.tab();
    await user.type(screen.getByLabelText(`${DENTAL} Coverage value`), '80');
    await user.tab();

    await waitFor(() =>
      expect(store.values.find((v) => v.optionFieldId === 'den_limit')?.value).toBe(600),
    );
    expect(store.values.find((v) => v.optionFieldId === 'den_coverage')?.value).toBe(80);

    // Neither is picked from a list — no figure is an answer anywhere here.
    for (const f of (store.options[0]?.fields ?? []).filter((field) =>
      ['CURRENCY', 'PERCENTAGE', 'NUMBER'].includes(field.dataType),
    )) {
      expect(store.choices.filter((c) => c.optionFieldId === f.id)).toEqual([]);
    }
  });

  it.each([
    [
      'Dental Network',
      'den_net_0',
      ['In-network only', 'In-network and out-of-network', 'Out-of-network only'],
    ],
    [
      'Frequency',
      'den_freq_0',
      ['Once per year', 'Once every 2 years', 'Once every 3 years', 'Once per policy period'],
    ],
  ])('reveals %s only when ticked, as a dropdown', async (condition, firstId, answers) => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${DENTAL} Dental Limit value`);

    expect(screen.queryByLabelText(`${DENTAL} ${condition} value`)).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: `${condition} for ${DENTAL}` }));

    const control = await screen.findByLabelText(`${DENTAL} ${condition} value`);
    expect(control.tagName).toBe('SELECT');
    expect(
      within(control)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Not specified', ...answers]);
    expect(control).toHaveValue('');

    await user.selectOptions(control, firstId);
    await waitFor(() => expect(store.values.find((v) => v.value === firstId)).toBeDefined());
  });

  it('takes the waiting period in months, and only when ticked', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${DENTAL} Dental Limit value`);

    expect(screen.queryByLabelText(`${DENTAL} Waiting period value`)).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: `Waiting period for ${DENTAL}` }));

    await user.type(await screen.findByLabelText(`${DENTAL} Waiting period value`), '6');
    await user.tab();
    await waitFor(() =>
      expect(store.values.find((v) => v.optionFieldId === 'den_waiting_period')?.value).toBe(6),
    );
    expect(screen.getByText('months')).toBeInTheDocument();
  });

  it('lets the employee write the dental services and tick several', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${DENTAL} Dental Limit value`);

    await user.click(
      screen.getByRole('checkbox', { name: `Included Dental Services for ${DENTAL}` }),
    );
    await user.click(
      await screen.findByRole('button', { name: `Included Dental Services for ${DENTAL}` }),
    );

    // Nothing is shipped: the services come from the document in hand.
    expect(store.choices.filter((c) => c.optionFieldId === 'den_included_services')).toEqual([]);

    for (const service of ['Fillings', 'Extractions', 'Root canal']) {
      await user.type(await screen.findByLabelText('New answer'), service);
      await user.click(screen.getByRole('button', { name: 'Add' }));
      await waitFor(() => expect(store.choices.some((c) => c.label === service)).toBe(true));
    }

    // Written means ticked — an employee who typed it meant it to apply.
    await waitFor(() =>
      expect(
        store.planOptions.find((item) => item.id === 'planOption_den')?.tickedChoiceIds,
      ).toHaveLength(3),
    );

    // And one can be released without being un-written.
    await user.click(screen.getByRole('checkbox', { name: 'Extractions' }));
    await waitFor(() =>
      expect(
        store.planOptions.find((item) => item.id === 'planOption_den')?.tickedChoiceIds,
      ).toHaveLength(2),
    );
    expect(store.choices.filter((c) => c.optionFieldId === 'den_included_services')).toHaveLength(
      3,
    );
  });

  it('keeps an untouched dental field empty, and a stated zero as zero', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const limit = await screen.findByLabelText(`${DENTAL} Dental Limit value`);
    expect(limit).toHaveValue('');
    expect(store.values).toHaveLength(0);

    await user.type(limit, '0');
    await user.tab();
    await waitFor(() =>
      expect(store.values.find((v) => v.optionFieldId === 'den_limit')?.value).toBe(0),
    );
  });
});

describe('empty means not specified, and zero means zero', () => {
  it('says so in the box itself rather than looking unfilled', async () => {
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    // An empty figure names what empty means, so nobody reads it as a gap.
    const coverage = await screen.findByLabelText(`${DENTAL} Coverage value`);
    expect(coverage).toHaveValue('');
    expect(coverage).toHaveAttribute('placeholder', 'Not specified');
    expect(await screen.findByLabelText(`${DENTAL} Dental Limit value`)).toHaveAttribute(
      'placeholder',
      'Not specified',
    );

    // Nothing was stored just because the card was opened.
    expect(store.values).toHaveLength(0);
  });

  it('never turns an untouched coverage into 0, and never loses a typed 0', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    const coverage = await screen.findByLabelText(`${DENTAL} Coverage value`);

    // Focusing and leaving without typing must not invent a figure.
    await user.click(coverage);
    await user.tab();
    expect(store.values.find((v) => v.optionFieldId === 'den_coverage')).toBeUndefined();

    // A document that says 0% said something, and it is not blank.
    await user.type(coverage, '0');
    await user.tab();
    await waitFor(() =>
      expect(store.values.find((v) => v.optionFieldId === 'den_coverage')?.value).toBe(0),
    );
    expect(coverage).toHaveValue('0');
  });

  it('names the blank choice on a dropdown instead of leaving it wordless', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${DENTAL} Dental Limit value`);

    await user.click(screen.getByRole('checkbox', { name: `Dental Network for ${DENTAL}` }));
    const network = await screen.findByLabelText(`${DENTAL} Dental Network value`);

    expect(within(network).getAllByRole('option')[0]?.textContent).toBe('Not specified');
    expect(network).toHaveValue('');
  });
});

// ---------------------------------------------------------------------------
// Dental — the procedures a document actually mentions
// ---------------------------------------------------------------------------

const PROCEDURES = ['Fillings', 'Simple extraction', 'Surgical extraction', 'Root canal', 'X-rays'];

/** The Covered Procedures condition, as production holds it. */
function givenCoveredProcedures() {
  const option = store.options.find((item) => item.id === 'option_den')!;
  option.fields = [
    ...(option.fields ?? []),
    {
      id: 'den_covered_procedures',
      optionId: 'option_den',
      label: 'Covered Procedures',
      key: 'covered_procedures',
      dataType: 'MULTI',
      unit: null,
      helpText: null,
      isRequired: false,
      sortOrder: 3,
      isActive: true,
      isOptional: true,
      parentFieldId: null,
      showWhenChoiceId: null,
      customerTypes: [],
      ...timestamps,
    },
  ];
  PROCEDURES.forEach((label, index) =>
    givenAnswer(`proc_${index}`, 'den_covered_procedures', label, index),
  );
}

const procedureTicks = () =>
  store.planOptions.find((item) => item.id === 'planOption_den')?.tickedChoiceIds ?? [];

describe('dental: covered procedures', () => {
  it('offers exactly the procedures the documents name, and no Other', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();
    givenCoveredProcedures();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${DENTAL} Dental Limit value`);

    // Hidden until the employee says the document mentions procedures at all.
    expect(screen.queryByRole('button', { name: `Covered Procedures for ${DENTAL}` })).toBeNull();

    await user.click(screen.getByRole('checkbox', { name: `Covered Procedures for ${DENTAL}` }));
    await user.click(
      await screen.findByRole('button', { name: `Covered Procedures for ${DENTAL}` }),
    );

    const offered = PROCEDURES.map(
      (name) => screen.getByRole('checkbox', { name }).getAttribute('aria-label') ?? name,
    );
    expect(offered).toEqual(PROCEDURES);
    // Nothing common-but-unmentioned, and no free-text escape hatch.
    expect(screen.queryByRole('checkbox', { name: /^Other$/i })).toBeNull();
    expect(
      screen.queryByRole('checkbox', { name: /crown|whitening|implant|orthodont/i }),
    ).toBeNull();
  });

  it('nothing is ticked by default — the employee reads the document', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();
    givenCoveredProcedures();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${DENTAL} Dental Limit value`);

    await user.click(screen.getByRole('checkbox', { name: `Covered Procedures for ${DENTAL}` }));
    await user.click(
      await screen.findByRole('button', { name: `Covered Procedures for ${DENTAL}` }),
    );

    for (const name of PROCEDURES) {
      expect(screen.getByRole('checkbox', { name })).not.toBeChecked();
    }
    expect(procedureTicks()).toEqual([]);
  });

  it('ticks one, then several, from the document in hand', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();
    givenCoveredProcedures();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${DENTAL} Dental Limit value`);
    await user.click(screen.getByRole('checkbox', { name: `Covered Procedures for ${DENTAL}` }));
    await user.click(
      await screen.findByRole('button', { name: `Covered Procedures for ${DENTAL}` }),
    );

    await user.click(screen.getByRole('checkbox', { name: 'Fillings' }));
    await waitFor(() => expect(procedureTicks()).toEqual(['proc_0']));

    // "…fillings, simple/surgical extraction, root canal, X-rays" — all five.
    for (const name of ['Simple extraction', 'Surgical extraction', 'Root canal', 'X-rays']) {
      await user.click(screen.getByRole('checkbox', { name }));
    }
    await waitFor(() => expect(procedureTicks()).toHaveLength(5));

    // And a selection can be taken back when the document is re-read.
    await user.click(screen.getByRole('checkbox', { name: 'X-rays' }));
    await waitFor(() => expect(procedureTicks()).toHaveLength(4));
    expect(procedureTicks()).not.toContain('proc_4');
  });

  /**
   * THE DISTINCTION THAT MATTERS.
   *
   * An unticked procedure says the document did not mention it. It does NOT say
   * the procedure is excluded, and the two must never collapse into each other:
   * one is silence, the other is a refusal, and only one of them is a promise
   * anybody made.
   */
  it('records silence as silence — an unticked procedure is not an exclusion', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();
    givenCoveredProcedures();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByLabelText(`${DENTAL} Dental Limit value`);

    // A document naming a limit and a co-payment but no procedures at all.
    await user.type(screen.getByLabelText(`${DENTAL} Dental Limit value`), '1000');
    await user.tab();
    await user.click(screen.getByRole('checkbox', { name: `Covered Procedures for ${DENTAL}` }));
    await waitFor(() =>
      expect(store.values.find((v) => v.optionFieldId === 'den_covered_procedures')).toBeDefined(),
    );

    /**
     * The condition is ON and nothing is ticked: "no procedures mentioned".
     * Not zero, not excluded, not absent — a row exists saying the question was
     * considered, and no answer claims anything either way.
     */
    expect(procedureTicks()).toEqual([]);
    expect(
      store.values.find((v) => v.optionFieldId === 'den_covered_procedures')?.value,
    ).toBeNull();

    // Switching the condition off is the different statement: the document
    // never raised procedures, so the plan records nothing about them.
    await user.click(screen.getByRole('checkbox', { name: `Covered Procedures for ${DENTAL}` }));
    await waitFor(() =>
      expect(
        store.values.find((v) => v.optionFieldId === 'den_covered_procedures'),
      ).toBeUndefined(),
    );
    expect(procedureTicks()).toEqual([]);
  });

  it('keeps the limit and co-payment as figures beside the procedures', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();
    givenCoveredProcedures();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    // The worked example: 1,500 EGP, 10% co-payment, five procedures named.
    await user.type(await screen.findByLabelText(`${DENTAL} Dental Limit value`), '1500');
    await user.tab();
    await user.click(screen.getByRole('checkbox', { name: `Co-payment for ${DENTAL}` }));
    await user.type(await screen.findByLabelText(`${DENTAL} Co-payment value`), '10');
    await user.tab();

    await waitFor(() =>
      expect(store.values.find((v) => v.optionFieldId === 'den_limit')?.value).toBe(1500),
    );
    expect(store.values.find((v) => v.optionFieldId === 'den_co_payment')?.value).toBe(10);
    // Coverage was not stated by that document, so it stays empty.
    expect(screen.getByLabelText(`${DENTAL} Coverage value`)).toHaveValue('');
    expect(store.values.find((v) => v.optionFieldId === 'den_coverage')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Other Key Benefits — a name can be the whole benefit
// ---------------------------------------------------------------------------

/** The five settings every Other Key Benefit may optionally record. */
const OPTIONAL_SETTINGS = ['Coverage', 'Limit', 'Co-payment', 'Waiting period', 'Frequency'];

/**
 * A benefit whose name IS the statement — "Covers Hepatitis" — with the five
 * settings available but none required.
 */
function givenStatementBenefit(name = 'Covers Hepatitis', id = 'option_stmt') {
  const field = (
    key: string,
    label: string,
    dataType: OptionFieldDto['dataType'],
    unit: string | null,
    sortOrder: number,
  ): OptionFieldDto => ({
    id: `${id}_${key}`,
    optionId: id,
    label,
    key,
    dataType,
    unit,
    helpText: null,
    isRequired: false,
    sortOrder,
    isActive: true,
    // Every one a toggle: the document decides which, if any, apply.
    isOptional: true,
    parentFieldId: null,
    showWhenChoiceId: null,
    customerTypes: [],
    ...timestamps,
  });

  store.options.push({
    id,
    name,
    description: null,
    sortOrder: 0,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [
      field('coverage', 'Coverage', 'PERCENTAGE', '%', 0),
      field('limit', 'Limit', 'CURRENCY', null, 1),
      field('co_payment', 'Co-payment', 'PERCENTAGE', '%', 2),
      field('waiting_period', 'Waiting period', 'NUMBER', 'months', 3),
      field('frequency', 'Frequency', 'RANK', null, 4),
    ],
  });
  ['Once per year', 'Once every 2 years', 'Once every 3 years', 'Once per policy period'].forEach(
    (label, index) => givenAnswer(`${id}_freq_${index}`, `${id}_frequency`, label, index),
  );
  return id;
}

function givenStatementOnAPlan(name = 'Covers Hepatitis') {
  givenCompany();
  givenInsuranceType();
  givenPlan();
  const configurationId = givenConfiguration('cfg_1', 'plan_1');
  givenStatementBenefit(name);
  store.planOptions.push({
    id: 'planOption_stmt',
    planConfigurationId: configurationId,
    optionId: 'option_stmt',
    sortOrder: 0,
  });
  return configurationId;
}

const valueFor = (key: string) =>
  store.values.find((v) => v.optionFieldId === `option_stmt_${key}`);

describe('other key benefits: a statement is a complete benefit', () => {
  it('records "Covers Hepatitis" with nothing but its name', async () => {
    const configurationId = givenStatementOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    // The name shows on the plan card and again in the panel it was dragged from.
    expect((await screen.findAllByText('Covers Hepatitis')).length).toBeGreaterThan(0);

    /**
     * No figure is demanded anywhere: not beside the name, not below it. A
     * document that says only "Covers Hepatitis" has been recorded in full.
     */
    expect(screen.queryByLabelText(/Covers Hepatitis .* value/)).toBeNull();
    expect(store.values).toHaveLength(0);

    // The five settings are offered, all switched off.
    for (const setting of OPTIONAL_SETTINGS) {
      expect(
        screen.getByRole('checkbox', { name: `${setting} for Covers Hepatitis` }),
      ).not.toBeChecked();
    }
  });

  it('describes itself as a statement, not as a percentage', async () => {
    const configurationId = givenStatementOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findAllByText('Covers Hepatitis');

    // Calling it "Percentage" would name it after a figure it need never hold.
    expect(screen.getAllByText('Statement of cover').length).toBeGreaterThan(0);
  });

  it('adds Coverage without Limit', async () => {
    const user = userEvent.setup();
    const configurationId = givenStatementOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findAllByText('Covers Hepatitis');

    await user.click(screen.getByRole('checkbox', { name: 'Coverage for Covers Hepatitis' }));
    await user.type(await screen.findByLabelText('Covers Hepatitis Coverage value'), '80');
    await user.tab();

    await waitFor(() => expect(valueFor('coverage')?.value).toBe(80));
    // Limit was never mentioned, so it is not there — and it is not zero.
    expect(screen.queryByLabelText('Covers Hepatitis Limit value')).toBeNull();
    expect(valueFor('limit')).toBeUndefined();
  });

  it('adds Limit without Coverage', async () => {
    const user = userEvent.setup();
    const configurationId = givenStatementOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findAllByText('Covers Hepatitis');

    await user.click(screen.getByRole('checkbox', { name: 'Limit for Covers Hepatitis' }));
    await user.type(await screen.findByLabelText('Covers Hepatitis Limit value'), '10000');
    await user.tab();

    await waitFor(() => expect(valueFor('limit')?.value).toBe(10000));
    expect(screen.queryByLabelText('Covers Hepatitis Coverage value')).toBeNull();
    expect(valueFor('coverage')).toBeUndefined();
  });

  it('lets several settings coexist, and grows one at a time', async () => {
    const user = userEvent.setup();
    const configurationId = givenStatementOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findAllByText('Covers Hepatitis');

    await user.click(screen.getByRole('checkbox', { name: 'Coverage for Covers Hepatitis' }));
    await user.type(await screen.findByLabelText('Covers Hepatitis Coverage value'), '80');
    await user.tab();

    await user.click(screen.getByRole('checkbox', { name: 'Limit for Covers Hepatitis' }));
    await user.type(await screen.findByLabelText('Covers Hepatitis Limit value'), '10000');
    await user.tab();

    await user.click(screen.getByRole('checkbox', { name: 'Frequency for Covers Hepatitis' }));
    const frequency = await screen.findByLabelText('Covers Hepatitis Frequency value');
    await user.selectOptions(frequency, 'option_stmt_freq_0');

    await waitFor(() => expect(valueFor('frequency')?.value).toBe('option_stmt_freq_0'));
    expect(valueFor('coverage')?.value).toBe(80);
    expect(valueFor('limit')?.value).toBe(10000);
    // The two nobody mentioned are still absent.
    expect(valueFor('co_payment')).toBeUndefined();
    expect(valueFor('waiting_period')).toBeUndefined();
  });

  it('never turns a setting the document skipped into zero', async () => {
    const user = userEvent.setup();
    const configurationId = givenStatementOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findAllByText('Covers Hepatitis');

    // Switched on, but the document gave no figure: it applies, unquantified.
    await user.click(screen.getByRole('checkbox', { name: 'Co-payment for Covers Hepatitis' }));
    await waitFor(() => expect(valueFor('co_payment')).toBeDefined());
    expect(valueFor('co_payment')?.value).toBeNull();
    expect(await screen.findByLabelText('Covers Hepatitis Co-payment value')).toHaveValue('');

    // Switched off again: the plan says nothing about it at all.
    await user.click(screen.getByRole('checkbox', { name: 'Co-payment for Covers Hepatitis' }));
    await waitFor(() => expect(valueFor('co_payment')).toBeUndefined());
  });

  it.each([
    ['Covers 25 Congenital Defects'],
    ['Covers Hepatitis'],
    ['COVID-19 inpatient coverage included'],
  ])('supports the document statement %s on its own', async (name) => {
    const configurationId = givenStatementOnAPlan(name);

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    expect((await screen.findAllByText(name)).length).toBeGreaterThan(0);
    expect(store.values).toHaveLength(0);
    expect(screen.getByRole('checkbox', { name: `Coverage for ${name}` })).not.toBeChecked();
  });
});
