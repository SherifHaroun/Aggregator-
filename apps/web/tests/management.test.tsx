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

import {
  GEOGRAPHICAL_COVERAGES,
  UNSPECIFIED_OPTION_LABEL,
  listEnabledOptions,
  planTier,
  resolveAverageAgeForCustomerType,
} from '@aggregator/shared';
import type { CustomerTypeId, OptionFieldDto, PlanDto } from '@aggregator/shared';
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

function givenPlan(
  id = 'plan_1',
  companyId = 'company_1',
  typeId = 'type_1',
  customerType: PlanDto['customerType'] = 'INDIVIDUAL',
) {
  store.plans.push({
    id,
    companyId,
    insuranceTypeId: typeId,
    customerType,
    name: 'Tier One',
    code: 'TIER-ONE',
    description: null,
    averageAge: resolveAverageAgeForCustomerType(customerType),
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

/**
 * Put a benefit on a variant the way an employee does: Add benefit, tick it,
 * confirm. There is no dragging any more — the catalogue lives on its own
 * screen and this picks from it.
 */
async function addBenefitOnVariant(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: /Add benefit/i }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.click(dialog.getByRole('checkbox', { name: new RegExp(name, 'i') }));
  await user.click(dialog.getByRole('button', { name: /^Add benefit/i }));
}

function givenConfiguration(
  id: string,
  planId: string,
  customerType: CustomerTypeId = 'INDIVIDUAL',
) {
  /**
   * Who the plan is for lives on the PLAN now, so a variant created for a
   * FAMILY is a variant of a family plan. Setting it here keeps the callers
   * reading the way they did while the record it lands on is the right one.
   */
  const plan = store.plans.find((item) => item.id === planId);
  if (plan) {
    plan.customerType = customerType;
    plan.averageAge = resolveAverageAgeForCustomerType(customerType);
  }

  store.configurations.push({
    id,
    planId,
    geographicalCoverage: 'LOCAL',
    medicalNetworkId: null,
    roomType: null,
    // One variant, priced across a band — never one variant per band.
    priceBands: [{ id: `${id}_band`, ageFrom: 18, ageTo: 60, annualPrice: 7500 }],
    currency: 'EGP',
    annualLimit: null,
    deductible: null,
    coPayment: null,
    isActive: true,
    ...timestamps,
  });
  return id;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('navigation', () => {
  it('offers exactly Dashboard, Compare plans, Add Company, Companies and Benefits', async () => {
    renderApp(ROUTES.dashboard);
    const sidebar = await screen.findByRole('navigation');
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim());

    /**
     * Benefits earns its place at the top level: the catalogue belongs to no
     * company — it is one list shared by all of them — so it cannot be reached
     * by drilling into one. Everything else still is.
     */
    expect(links).toEqual([
      'Dashboard',
      'Compare plans',
      'Add Company',
      'Companies',
      'Benefits',
    ]);
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

    /**
     * A BUSINESS IS ASKED FOR ITS WORKFORCE, not for an age.
     *
     * SME cover is still compared against a standard age, but that is an
     * assumption about how the cover is sold rather than anything the employer
     * said — an employer shown "Average age 35" would reasonably read it as a
     * claim about their own staff. So it is not on the form at all.
     */
    await user.click(screen.getByRole('radio', { name: /SME/i }));
    await waitFor(() => expect(screen.queryByLabelText(/^Age/)).not.toBeInTheDocument());
    expect(screen.queryByText(/Average age/i)).not.toBeInTheDocument();
    expect(screen.queryByText('35')).not.toBeInTheDocument();

    // What it asks for instead: how many employees are in each age group.
    expect(screen.getByText('Employee ages')).toBeInTheDocument();
    expect(screen.getByText(/0 employees/)).toBeInTheDocument();

    // Switching back hands the customer their own figure again.
    await user.click(screen.getByRole('radio', { name: /Individual/i }));
    await waitFor(() => expect(screen.getByLabelText(/^Age/)).toHaveValue(52));
  });

  it('shows the three plan tiers, with nothing to add', async () => {
    renderApp(ROUTES.planTiers.list);
    expect(
      await screen.findByRole('heading', { name: 'Plan tiers', level: 1 }),
    ).toBeInTheDocument();

    for (const tier of ['Basic', 'Standard', 'Premium']) {
      // The table renders a desktop row and a mobile card, so each label
      // legitimately appears more than once.
      expect((await screen.findAllByText(tier)).length).toBeGreaterThan(0);
    }

    /**
     * A reference, not a register. The tier is read off each variant's annual
     * limit, so there is nothing stored to create, rename or delete — the old
     * screen let an employee file a plan under a category that could then
     * disagree with the plan's own figures.
     */
    // "Add Company" lives in the sidebar on every screen, so this asks about
    // adding a TIER specifically.
    expect(
      screen.queryByRole('button', { name: /Add (insurance type|tier|plan tier)/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add (insurance type|tier)/i })).not.toBeInTheDocument();
  });

  it('sorts a variant into its tier by what the plan actually pays', async () => {
    givenCompany();
    givenPlan();
    // 30,000 is Basic; 75,000 is Standard. Neither was chosen by anybody.
    givenConfiguration('cfg_basic', 'plan_1');
    store.configurations[0]!.annualLimit = 30000;
    givenConfiguration('cfg_standard', 'plan_1');
    store.configurations[1]!.annualLimit = 75000;
    store.configurations[1]!.geographicalCoverage = 'INTERNATIONAL';

    renderApp(ROUTES.planTiers.list);

    const row = async (tier: string) => {
      const cells = await screen.findAllByText(tier);
      return cells.map((cell) => cell.closest('tr')).find((found) => found !== null)!;
    };
    const basic = await row('Basic');
    const standard = await row('Standard');
    const premium = await row('Premium');

    expect(within(basic).getByText('1')).toBeInTheDocument();
    expect(within(standard).getByText('1')).toBeInTheDocument();
    expect(within(premium).getByText(/None yet/i)).toBeInTheDocument();
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
    // A price lives on a BAND, so that is where each variant's is set.
    store.configurations.find((c) => c.id === cheap)!.priceBands[0]!.annualPrice = 600;
    store.configurations.find((c) => c.id === dear)!.priceBands[0]!.annualPrice = 1500;

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
    store.configurations.find((c) => c.id === only)!.priceBands[0]!.annualPrice = 1500;

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

  it('counts plans, benefits and companies from the database', async () => {
    givenCompany('company_1', 'Northwind Assurance');
    givenCompany('company_2', 'Southwind Mutual');
    givenInsuranceType();
    givenPlan();
    givenOption('option_1', 'Aurora Wellness Programme');
    givenOption('option_2', 'Zenith Travel Assistance');

    renderApp(ROUTES.dashboard);

    // The label sits in the tile's header row; the count is its sibling. Tiles
    // show a dash until their query lands, so wait for the real figure.
    /**
     * Scoped to the tiles: "Benefits" is also a sidebar link now, and the
     * dashboard is asking about the count rather than the navigation.
     */
    const tiles = within(await screen.findByRole('main'));
    const tile = (label: string) =>
      tiles.getByText(label).parentElement?.parentElement?.textContent ?? '';

    await screen.findByText('Available plans');
    await waitFor(() => {
      expect(tile('Available plans')).toMatch(/1/);
      expect(tile('Benefits')).toMatch(/2/);
      expect(tile('Insurance companies')).toMatch(/2/);
      // A fixed set of three, not a count that grows: the tiers are read off
      // each variant's annual limit rather than created by anybody.
      expect(tile('Plan tiers')).toMatch(/3/);
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
      ['Plan tiers', ROUTES.planTiers.list],
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

  it('opens the plan tiers from the dashboard tile', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenPlan();

    renderApp(ROUTES.dashboard);

    const tile = (await screen.findAllByRole('link', { name: /Plan tiers/i })).find(
      (link) => link.getAttribute('href') === ROUTES.planTiers.list,
    );
    await user.click(tile!);

    expect(
      await screen.findByRole('heading', { name: 'Plan tiers', level: 1 }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Basic')).length).toBeGreaterThan(0);
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

  it('prompts for the first plan of the section being viewed', async () => {
    givenCompany();
    renderApp(ROUTES.companies.detail('company_1'));
    // Individual opens first, and the prompt names it: a company's three books
    // are separate products, so "no plans" is always about one of them.
    expect(await screen.findByText('No individual plans yet')).toBeInTheDocument();
  });

  it('offers Individual, Family and SME as the way into a company', async () => {
    givenCompany();
    renderApp(ROUTES.companies.detail('company_1'));

    const tabs = await screen.findByRole('tablist', { name: /Customer type/i });
    const labels = within(tabs)
      .getAllByRole('tab')
      .map((tab) => tab.textContent ?? '');

    expect(labels).toHaveLength(3);
    for (const expected of ['Individual', 'Family', 'SME']) {
      expect(labels.some((label) => label.includes(expected))).toBe(true);
    }
  });

  it('shows only the plans of the section that is open', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan('plan_individual', 'company_1', 'type_1', 'INDIVIDUAL');
    store.plans.push({
      ...store.plans[0]!,
      id: 'plan_family',
      customerType: 'FAMILY',
      name: 'Tier One',
      code: 'TIER-ONE-FAMILY',
    });

    renderApp(ROUTES.companies.detail('company_1'));

    // The same displayed name under two customer types: one record each, and
    // only one of them is ever on screen.
    expect(await screen.findAllByText('Tier One')).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: /SME/i }));
    expect(await screen.findByText('No sme plans yet')).toBeInTheDocument();
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

  it('creates the company and stops there', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.companies.new);

    await user.type(await screen.findByLabelText(/Company name/i), 'Northwind Assurance');
    await user.click(screen.getByRole('button', { name: /Create company/i }));

    await waitFor(() => expect(store.companies).toHaveLength(1));
    expect(store.companies[0]).toMatchObject({ name: 'Northwind Assurance', isActive: true });

    /**
     * Creating a company creates a COMPANY. It used to march straight on into
     * adding a plan, which assumed the reason for the company was the plan —
     * but its networks are usually entered first, and a company is worth
     * recording before its products are known.
     */
    expect(await screen.findByRole('tablist', { name: /Customer type/i })).toBeInTheDocument();
    expect(screen.queryByText(/Step 2 of 2/i)).not.toBeInTheDocument();
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
    await user.type(dialog.getByLabelText(/Annual \/ in-patient limit/i), '600000');
    await user.selectOptions(network, 'net_a1');
    await user.type(dialog.getByLabelText('Variant 1 premium, ages 1 to 17'), '3681');
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
  it('creates a plan without asking anybody to categorise it', async () => {
    const user = userEvent.setup();
    givenCompany();

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    // Scope to the dialog: a real <dialog> makes the page behind it inert, but
    // jsdom keeps the trigger button queryable.
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Plan name/i), 'Tier One');
    await user.type(dialog.getByLabelText(/Annual \/ in-patient limit/i), '600000');
    await user.type(dialog.getByLabelText('Variant 1 premium, ages 1 to 17'), '3681');
    await user.click(dialog.getByRole('button', { name: /Save plan/i }));

    await waitFor(() => expect(store.plans).toHaveLength(1));
    /**
     * NOTHING was filed under a category. How good the plan is gets read off
     * its variant's annual limit — 600,000 here, so Premium — which is why no
     * category record is created and none is asked for.
     */
    expect(store.insuranceTypes).toHaveLength(0);
    expect(planTier(store.configurations[0]?.annualLimit ?? null)).toBe('PREMIUM');
    /**
     * The code is derived so the employee never has to invent one, and it
     * carries the BUYER: a company's Individual and Family "Tier One" are two
     * products, and a code without it would let the first block the second.
     *
     * The displayed name stays clean — the suffix is database identity, never
     * something the employee reads.
     */
    expect(store.plans[0]).toMatchObject({
      name: 'Tier One',
      code: 'TIER-ONE-INDIVIDUAL',
      customerType: 'INDIVIDUAL',
    });
    expect(store.plans[0]?.name).not.toContain('INDIVIDUAL');
  });

  it('stores the price on the configuration, never on the plan', async () => {
    const user = userEvent.setup();
    givenCompany();

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Plan name/i), 'Tier One');
    await user.type(dialog.getByLabelText(/Annual \/ in-patient limit/i), '600000');
    await user.type(dialog.getByLabelText('Variant 1 premium, ages 1 to 17'), '7500');
    await user.click(dialog.getByRole('button', { name: /Save plan/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));

    // The product carries no pricing; its variant does — and the premium sits
    // on a BAND of that variant, because age is the only thing that moves it.
    expect(store.plans[0]).not.toHaveProperty('annualPrice');
    expect(store.configurations[0]).not.toHaveProperty('annualPrice');
    expect(store.configurations[0]).toMatchObject({
      planId: store.plans[0]?.id,
      geographicalCoverage: 'LOCAL',
      annualLimit: 600000,
    });
    // Who the plan is for is the PLAN's.
    expect(store.plans[0]?.customerType).toBe('INDIVIDUAL');
    expect(store.configurations[0]?.priceBands).toMatchObject([
      { ageFrom: 1, ageTo: 17, annualPrice: 7500 },
    ]);
  });

  /**
   * The point of the form: age is a pricing axis, not a benefit axis.
   *
   * The legacy data said so outright — across 32 products, all 69 age rows of
   * each carried an identical benefit set, and only the premium moved. So the
   * benefits are filled in once and every band priced carries them.
   */
  /**
   * One product, sold two ways.
   *
   * "Gold+ Local" and "Gold+ International" are the SAME plan at two coverage
   * scopes — the legacy habit of making them two plans with the scope in the
   * name is exactly what the variant model exists to stop. The name is derived
   * from the plan and the scope, so it can never disagree with them.
   */
  it('makes two variants of one plan, named from the plan and the coverage', async () => {
    const user = userEvent.setup();
    givenCompany();

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Plan name/i), 'Gold+');

    // Variant 1 is named the moment the plan is, without anybody typing it.
    expect(dialog.getByLabelText(/Variant name/i)).toHaveValue('Gold+ Local');

    await user.type(dialog.getAllByLabelText(/Annual \/ in-patient limit/i)[0]!, '600000');
    await user.type(dialog.getByLabelText('Variant 1 premium, ages 1 to 17'), '3681');

    await user.click(dialog.getByRole('button', { name: /Add variant/i }));

    // The second offers the next scope, so the two cannot collide on save.
    const names = dialog.getAllByLabelText(/Variant name/i);
    expect(names).toHaveLength(2);
    expect(names[1]).toHaveValue('Gold+ International');

    await user.type(dialog.getAllByLabelText(/Annual \/ in-patient limit/i)[1]!, '1000000');
    await user.type(dialog.getByLabelText('Variant 2 premium, ages 1 to 17'), '5000');

    await user.click(dialog.getByRole('button', { name: /Save plan/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(2));

    // ONE plan, two variants — never "Gold+ Local" and "Gold+ International"
    // as separate products.
    expect(store.plans).toHaveLength(1);
    expect(store.plans[0]?.name).toBe('Gold+');
    expect(store.configurations.map((item) => item.geographicalCoverage).sort()).toEqual([
      'INTERNATIONAL',
      'LOCAL',
    ]);
    expect(
      store.configurations.map((item) => item.annualLimit).sort((a, b) => (a ?? 0) - (b ?? 0)),
    ).toEqual([600000, 1000000]);
  });

  it('enters benefits ONCE for a variant priced across many bands', async () => {
    const user = userEvent.setup();
    givenCompany();

    renderApp(ROUTES.companies.detail('company_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add plan/i }))[0]!);

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Plan name/i), 'Elite');
    await user.type(dialog.getByLabelText(/Annual \/ in-patient limit/i), '600000');
    /**
     * In-patient is quoted as a share of the bill, and the box is NAMED for
     * that — the kind is fixed by the business, so the label states it rather
     * than leaving the employee to guess what the number means.
     */
    await user.type(dialog.getByLabelText('In-patient Coverage'), '80');
    // Two areas are quoted as a percentage; both say so under their box.
    expect(dialog.getAllByText(/Accepts a percentage only/i)).toHaveLength(2);
    expect(dialog.getAllByText(/Accepts a limit only/i)).toHaveLength(4);

    // And a ceiling area says the opposite, in the same place.
    expect(dialog.getByLabelText('Dental Limit')).toBeInTheDocument();
    expect(dialog.queryByLabelText(/co-payment/i)).not.toBeInTheDocument();

    // Three bands, three premiums, one benefit entry.
    await user.type(dialog.getByLabelText('Variant 1 premium, ages 1 to 17'), '3681');
    await user.type(dialog.getByLabelText('Variant 1 premium, ages 18 to 24'), '5701');
    await user.type(dialog.getByLabelText('Variant 1 premium, ages 25 to 29'), '7132');
    await user.click(dialog.getByRole('button', { name: /Save plan/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));

    /**
     * ONE variant. Three prices. One benefit.
     *
     * This is the whole point of the model: the legacy data showed all 69 age
     * rows of each product carried an identical benefit set and only the
     * premium moved, so the cover is stored once and the prices hang off it.
     * The old form made three configurations here, each with its own copy.
     */
    const variant = store.configurations[0]!;
    expect(variant.priceBands.map((band) => band.annualPrice)).toEqual([3681, 5701, 7132]);

    // A band with no premium is simply not sold, so no row is made for it.
    expect(variant.priceBands).toHaveLength(3);

    const attached = store.planOptions.filter(
      (item) => item.planConfigurationId === variant.id,
    );
    expect(attached).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Configurations
// ---------------------------------------------------------------------------

describe('plan configurations', () => {
  it('offers exactly Individual, Family and SME — no Couple', async () => {
    givenCompany();
    renderApp(ROUTES.companies.detail('company_1'));

    // The buyer is chosen on the COMPANY now, as the section a plan is filed
    // under, so this is where the list has to be exactly the three.
    const tabs = await screen.findByRole('tablist', { name: /Customer type/i });
    const labels = within(tabs)
      .getAllByRole('tab')
      .map((tab) => tab.textContent ?? '');

    expect(labels.some((l) => l.includes('Individual'))).toBe(true);
    expect(labels.some((l) => l.includes('Family'))).toBe(true);
    expect(labels.some((l) => l.includes('SME'))).toBe(true);
    expect(labels.some((l) => /couple/i.test(l))).toBe(false);
  });

  it('offers every coverage scope the shared configuration enables', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add variant/i }))[0]!);

    const group = await screen.findByRole('group', { name: /Geographical coverage/i });
    const labels = within(group)
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent ?? '');

    /**
     * The list is whatever @aggregator/shared enables — never a second copy
     * written down here. It grew past Local and International because insurers
     * sell wider scopes, and it may grow again.
     */
    const enabled = listEnabledOptions(GEOGRAPHICAL_COVERAGES);
    expect(labels).toHaveLength(enabled.length);
    for (const option of enabled) {
      expect(labels.some((label) => label.includes(option.label))).toBe(true);
    }
  });

  it('never asks a variant who it is for — that belongs to the plan', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add variant/i }))[0]!);

    await screen.findByRole('group', { name: /Geographical coverage/i });
    /**
     * A company's Individual, Family and SME books are separate products, so
     * the buyer is chosen once when the plan is filed under a section — asking
     * again per variant would let one plan's variants disagree about it.
     */
    expect(screen.queryByRole('group', { name: /Who is this for/i })).not.toBeInTheDocument();
  });

  it('shows the fixed SME average age on the plan, not on a variant', async () => {
    givenCompany();
    givenInsuranceType();
    givenPlan('plan_1', 'company_1', 'type_1', 'SME');
    const configurationId = givenConfiguration('cfg_1', 'plan_1', 'SME');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    expect(await screen.findByText(/Average age: 35/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/average age/i)).not.toBeInTheDocument();
  });

  it('creates a variant with its terms, and no age of its own', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();

    renderApp(ROUTES.plans.detail('company_1', 'plan_1'));
    await user.click((await screen.findAllByRole('button', { name: /Add variant/i }))[0]!);

    const where = await screen.findByRole('group', { name: /Geographical coverage/i });
    await user.click(within(where).getAllByRole('radio')[0]!);

    await user.type(screen.getByLabelText(/Currency/i), 'EGP');
    await user.type(screen.getByLabelText(/Annual limit/i), '600000');
    await user.click(screen.getByRole('button', { name: /Save variant/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));
    expect(store.configurations[0]).toMatchObject({
      geographicalCoverage: 'LOCAL',
      currency: 'EGP',
      annualLimit: 600000,
    });
    // The age band and the premium are not the variant's to hold.
    expect(store.configurations[0]).not.toHaveProperty('ageFrom');
    expect(store.configurations[0]).not.toHaveProperty('annualPrice');
  });

  it('refuses an age band that runs backwards, in the rate table', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const from = await screen.findByLabelText('Age from');
    await user.clear(from);
    await user.type(from, '70');
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    expect(await screen.findByText(/Ages 50–60 run backwards|run backwards/i)).toBeInTheDocument();
  });

  it('refuses the same age band twice', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: /Add age band/i }));
    const froms = screen.getAllByLabelText('Age from');
    const tos = screen.getAllByLabelText('Age to');
    await user.clear(froms[1]!);
    await user.type(froms[1]!, '18');
    await user.clear(tos[1]!);
    await user.type(tos[1]!, '60');

    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(await screen.findByText(/overlap/i)).toBeInTheDocument();
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
    await user.click((await screen.findAllByRole('button', { name: /Add variant/i }))[0]!);

    const where = await screen.findByRole('group', { name: /Geographical coverage/i });
    await user.click(within(where).getAllByRole('radio')[0]!);

    const limit = screen.getByLabelText(/Annual limit/i);
    await user.type(limit, '100000');
    // Read back the way the plan document writes it.
    expect(limit).toHaveValue('100,000');

    await user.click(screen.getByRole('button', { name: /Save variant/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));
    // What is stored is a number, never the separators.
    expect(store.configurations[0]?.annualLimit).toBe(100000);
  });

  it('reads a figure the plan never stated as blank, never as zero', async () => {
    givenCompany();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenDentalCatalogueRecord();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    /**
     * Blank and 0 are different statements. The document said nothing about
     * dental here, so the box is empty — a 0 would be the plan declining it.
     */
    expect(await screen.findByLabelText('Dental Limit')).toHaveValue('');
    expect(screen.queryByText('Not covered')).not.toBeInTheDocument();
    expect(store.values).toHaveLength(0);
  });
});

describe('editing a plan', () => {
  it('never asks an employee to categorise a plan', async () => {
    const user = userEvent.setup();
    givenCompany();
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
    await screen.findByLabelText(/Plan name/i);

    /**
     * The category is gone from the form because it is gone from the model.
     * Basic, Standard and Premium are read off the variant's annual limit, so
     * filing a plan under a tier by hand could only ever produce a tier that
     * disagreed with what the plan actually pays.
     */
    expect(screen.queryByLabelText(/Insurance type/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save plan/i }));

    // Saving carries nothing away with it: the cover is exactly as it was.
    await waitFor(() => expect(store.plans).toHaveLength(1));
    expect(store.configurations).toHaveLength(1);
    expect(store.planOptions).toHaveLength(1);
  });

  it("re-reads a plan's tier when its ceiling moves, with nobody refiling it", async () => {
    givenCompany();
    givenPlan();
    givenConfiguration('cfg_1', 'plan_1');

    // Under 50,000 reads as Basic...
    store.configurations[0]!.annualLimit = 30000;
    expect(planTier(store.configurations[0]!.annualLimit)).toBe('BASIC');

    // ...and raising the ceiling is the only act needed to change the tier.
    store.configurations[0]!.annualLimit = 150000;
    expect(planTier(store.configurations[0]!.annualLimit)).toBe('PREMIUM');

    // A ceiling nobody stated is not the cheapest tier — it is no tier.
    store.configurations[0]!.annualLimit = null;
    expect(planTier(store.configurations[0]!.annualLimit)).toBeNull();
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
    // The code follows the name unless one is typed, and keeps the buyer the
    // plan is copied for — a copy is sold to the same people as its original.
    expect(screen.getByLabelText(/Plan code/i)).toHaveValue('TIER-TWO-INDIVIDUAL');

    // Everything is selected by default; drop the older band.
    const choices = screen.getAllByRole('checkbox');
    expect(choices).toHaveLength(2);
    await user.click(choices[1]!);

    await user.click(screen.getByRole('button', { name: /Create the copy/i }));

    await waitFor(() => expect(store.plans).toHaveLength(2));
    const copy = store.plans[1]!;
    expect(copy.name).toBe('Tier Two');
    expect(copy.code).toBe('TIER-TWO-INDIVIDUAL');

    // One configuration came across, with its benefit, value and note.
    const copied = store.configurations.filter((item) => item.planId === copy.id);
    expect(copied).toHaveLength(1);
    expect(copied[0]?.priceBands?.[0]?.ageFrom).toBe(18);

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

describe('another age', () => {
  /**
   * This used to be a COPY: a whole second configuration carrying a duplicate
   * of every benefit, because the age band was part of the row. It is now a
   * row in the variant's own rate table, so the cover is not touched at all —
   * which is the entire point of the model.
   */
  it('adds a price band without copying anything', async () => {
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

    await user.click(await screen.findByRole('button', { name: /Add age band/i }));

    const froms = screen.getAllByLabelText('Age from');
    const tos = screen.getAllByLabelText('Age to');
    await user.clear(froms[1]!);
    await user.type(froms[1]!, '61');
    await user.clear(tos[1]!);
    await user.type(tos[1]!, '65');
    await user.type(screen.getByLabelText(/Annual premium for ages 61 to 65/i), '15984');

    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => expect(store.configurations[0]?.priceBands).toHaveLength(2));

    // Still ONE variant, and its benefit was never duplicated.
    expect(store.configurations).toHaveLength(1);
    expect(store.configurations[0]?.priceBands[1]).toMatchObject({
      ageFrom: 61,
      ageTo: 65,
      annualPrice: 15984,
    });
    expect(store.planOptions.filter((item) => item.planConfigurationId === configurationId))
      .toHaveLength(1);
  });

  it('says a band with no premium is not covered, and stores no zero', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenInsuranceType();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.click(await screen.findByRole('button', { name: /Add age band/i }));
    // The new row is left unpriced, which is how a plan says it is not sold.
    expect(await screen.findByText('Not covered')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => expect(store.configurations[0]?.priceBands).toHaveLength(2));
    expect(store.configurations[0]?.priceBands[1]?.annualPrice).toBeNull();
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

    renderApp(ROUTES.benefits.list);

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

    renderApp(ROUTES.benefits.list);

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

    renderApp(ROUTES.benefits.list);

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
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');

    givenOption('option_group', 'Life & Accident Coverage');
    store.options[0]!.isUmbrella = true;
    store.options[0]!.fields = [];
    givenOption('option_death', 'Death (Natural)');
    store.options[1]!.parentId = 'option_group';

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await addBenefitOnVariant(user, 'Life & Accident Coverage');

    // One gesture, two rows: the heading and the benefit filed under it.
    await waitFor(() => expect(store.planOptions).toHaveLength(2));

    /**
     * It reads as ONE additional benefit. A group's members are what it is
     * made of, not separate things a plan states — and an additional benefit
     * is stated in words rather than figures, so there is no box per member.
     */
    const additional = within(screen.getByRole('region', { name: 'Additional benefits' }));
    expect(await additional.findByText('Life & Accident Coverage')).toBeInTheDocument();
    expect(additional.queryByText('Death (Natural)')).not.toBeInTheDocument();

    await user.click(additional.getByRole('button', { name: 'Remove Life & Accident Coverage' }));
    await waitFor(() => expect(store.planOptions).toHaveLength(1));
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

    renderApp(ROUTES.benefits.list);

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



  it('records a detail against a benefit, kept per variant', async () => {
    const user = userEvent.setup();
    givenCompany();
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

    const additional = within(await screen.findByRole('region', { name: 'Additional benefits' }));
    await user.click(additional.getByRole('button', { name: /Add detail/i }));
    await user.type(
      await screen.findByLabelText('Aurora Wellness Programme detail 1'),
      '1 in 10 members ratio',
    );
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    /**
     * The detail belongs to this VARIANT, not to the benefit: the same benefit
     * is qualified differently on the next plan.
     */
    await waitFor(() =>
      expect(store.planOptions[0]?.note).toBe('1 in 10 members ratio'),
    );
  });

  /**
   * The qualification that the comparison can actually read.
   *
   * A note saying "basic procedures only" was invisible to the engine, so two
   * plans quoting the same figure scored the same. Ticking a catalogue record
   * instead is what makes the difference count.
   */


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

    renderApp(ROUTES.benefits.list);

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
  it('ranks a setting’s answers, and removes them, from the benefit itself', async () => {
    const user = userEvent.setup();
    givenRankedOption('option_1', 'Medical Network');

    renderApp(ROUTES.benefits.list);
    await user.click(await screen.findByRole('button', { name: 'Edit Medical Network' }));

    /**
     * The answers belong to the BENEFIT, not to any one plan: every plan that
     * records this setting picks from the same list, which is why the list is
     * managed here rather than on a variant.
     */
    // The dialog re-reads the benefit so the list reflects the latest order.
    await screen.findByLabelText(/Benefit name/i);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reorder Golden Care Network' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Reorder Orange Care Network' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Orange Care Network' }));
    await waitFor(() => expect(store.choices.find((c) => c.id === 'choice_orange')).toBeUndefined());
    expect(store.choices.find((c) => c.id === 'choice_gold')).toBeDefined();
  });

  it('adds an answer to a setting from the benefit itself', async () => {
    const user = userEvent.setup();
    givenRankedOption('option_1', 'Medical Network');

    renderApp(ROUTES.benefits.list);
    await user.click(await screen.findByRole('button', { name: 'Edit Medical Network' }));

    await user.type(await screen.findByLabelText('New answer'), 'Out-of-network only');
    await user.keyboard('{Enter}');

    // One list, offered to every plan that records this setting.
    await waitFor(() =>
      expect(store.choices.some((c) => c.label === 'Out-of-network only')).toBe(true),
    );
  });


  it('renames a benefit, and the variant that carries it follows', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    const catalogue = renderApp(ROUTES.benefits.list);
    await user.click(await screen.findByRole('button', { name: 'Edit Aurora Wellness Programme' }));
    const field = await screen.findByLabelText(/Benefit name/i);
    await user.clear(field);
    await user.type(field, 'Wellness Programme');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));
    await waitFor(() => expect(store.options[0]?.name).toBe('Wellness Programme'));

    /**
     * The benefit is ONE record, shared by every plan pointing at it, so the
     * variant reads the new name without anybody touching the variant.
     */
    catalogue.unmount();
    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    const additional = within(await screen.findByRole('region', { name: 'Additional benefits' }));
    expect(await additional.findByText('Wellness Programme')).toBeInTheDocument();
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

    renderApp(ROUTES.benefits.list);

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

    renderApp(ROUTES.benefits.list);

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

    renderApp(ROUTES.benefits.list);

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

    renderApp(ROUTES.benefits.list);

    await user.click(
      await screen.findByRole('button', { name: 'Delete Aurora Wellness Programme' }),
    );
    expect(await screen.findByText(/1 variant that carries it/i)).toBeInTheDocument();
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

    renderApp(ROUTES.benefits.list);

    await user.click(await screen.findByRole('button', { name: 'Delete Death (Natural)' }));
    await user.click(await screen.findByRole('button', { name: /^Delete$/ }));

    await waitFor(() => expect(store.options).toHaveLength(1));
    expect(store.options[0]?.name).toBe('Life & Accident Coverage');
  });




});

// ---------------------------------------------------------------------------
// Drag and drop, values, isolation
// ---------------------------------------------------------------------------

describe('plan coverage', () => {
  it('adds a benefit by picking it from the catalogue', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    // Nothing additional until it is chosen — a variant states what it states.
    expect(await screen.findByText('No additional benefits selected.')).toBeInTheDocument();

    await addBenefitOnVariant(user, 'Aurora Wellness Programme');

    const additional = within(screen.getByRole('region', { name: 'Additional benefits' }));
    expect(await additional.findByText('Aurora Wellness Programme')).toBeInTheDocument();
    await waitFor(() => expect(store.planOptions).toHaveLength(1));
  });

  it('shows a picked benefit before the server answers, and takes it back if the save fails', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenPlan();
    const configurationId = givenConfiguration('cfg_1', 'plan_1');
    givenOption();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByText('No additional benefits selected.');

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

    await addBenefitOnVariant(user, 'Aurora Wellness Programme');

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


  it('keeps each variant’s figures separate', async () => {
    const user = userEvent.setup();
    givenCompany();
    givenPlan();
    const first = givenConfiguration('cfg_1', 'plan_1');
    const second = givenConfiguration('cfg_2', 'plan_1');
    store.configurations[1]!.geographicalCoverage = 'INTERNATIONAL';
    givenDentalCatalogueRecord();

    const one = renderApp(ROUTES.configurations.detail('company_1', 'plan_1', first));
    await user.type(await screen.findByLabelText('Dental Limit'), '2500');
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    await waitFor(() => expect(store.values).toHaveLength(1));
    one.unmount();

    /**
     * The second variant of the SAME plan carries none of it. Values belong to
     * a variant, so one can never read as the other.
     */
    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', second));
    expect(await screen.findByLabelText('Dental Limit')).toHaveValue('');
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

    const offered = async () => {
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /Add benefit/i }));
      const dialog = within(await screen.findByRole('dialog'));
      return dialog.queryByRole('checkbox', { name: /Outpatient Care/i });
    };

    const first = renderApp(ROUTES.configurations.detail('company_a', 'plan_a', a));
    expect(await offered()).toBeInTheDocument();
    first.unmount();

    renderApp(ROUTES.configurations.detail('company_b', 'plan_b', b));
    expect(await offered()).toBeInTheDocument();

    // Nobody had to create it twice.
    expect(store.options).toHaveLength(1);
  });

  it('lets two companies quote the same core area differently', async () => {
    const user = userEvent.setup();
    const { a, b } = givenTwoCompanies();
    givenDentalCatalogueRecord();

    const first = renderApp(ROUTES.configurations.detail('company_a', 'plan_a', a));
    await user.type(await screen.findByLabelText('Dental Limit'), '2500');
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    await waitFor(() => expect(store.values).toHaveLength(1));
    first.unmount();

    renderApp(ROUTES.configurations.detail('company_b', 'plan_b', b));
    await user.type(await screen.findByLabelText('Dental Limit'), '5000');
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    await waitFor(() => expect(store.values).toHaveLength(2));

    /**
     * One catalogue record, two figures. What differs between companies is
     * what their plans PAY, never which benefits exist.
     */
    expect(store.options.filter((option) => option.name === DENTAL)).toHaveLength(1);
    expect(store.values.map((value) => value.value).sort()).toEqual([2500, 5000]);
  });

  it('creates no second record when the same benefit is dropped on another plan', async () => {
    const { a, b } = givenTwoCompanies();
    givenOption('option_1', 'Outpatient Care');

    const user = userEvent.setup();
    const first = renderApp(ROUTES.configurations.detail('company_a', 'plan_a', a));
    await addBenefitOnVariant(user, 'Outpatient Care');
    await waitFor(() => expect(store.planOptions).toHaveLength(1));
    first.unmount();

    renderApp(ROUTES.configurations.detail('company_b', 'plan_b', b));
    await addBenefitOnVariant(user, 'Outpatient Care');
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

    renderApp(ROUTES.benefits.list);

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


// ---------------------------------------------------------------------------
// Dental — two figures the documents always state, five conditions they may
// ---------------------------------------------------------------------------

const DENTAL = 'Dental Details';

/** Mirrors the definition held in Railway production, field for field. */
/**
 * Dental in the catalogue, with nothing attached to any variant yet.
 *
 * "Dental Details" is what a real company filed it as; the editor recognises
 * it as the Dental core area through the shared aliases.
 */
function givenDentalCatalogueRecord() {
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
      {
        id: 'den_limit',
        optionId: 'option_den',
        label: 'Dental Limit',
        key: 'limit',
        dataType: 'CURRENCY',
        unit: null,
        helpText: null,
        isRequired: false,
        isOptional: false,
        sortOrder: 0,
        isActive: true,
        ...timestamps,
      },
    ],
  });
}

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


describe('empty means not specified, and zero means zero', () => {
  it('leaves a figure nobody stated empty, and stores nothing for it', async () => {
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    /**
     * Dental is quoted as a CEILING — fixed by the business, not chosen — so
     * the area asks for one figure and names it.
     */
    const limit = await screen.findByLabelText('Dental Limit');
    expect(limit).toHaveValue('');

    // Nothing was stored just because the variant was opened.
    expect(store.values).toHaveLength(0);
  });

  it('keeps a typed 0, because 0 is the plan declining the area', async () => {
    const user = userEvent.setup();
    const configurationId = givenDentalOnAPlan();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    const limit = await screen.findByLabelText('Dental Limit');

    /**
     * A document that says 0 said something. It is not a blank, and it is not
     * the weakest cover either — it is the plan declining dental, and the
     * screen says so beside the box.
     */
    await user.type(limit, '0');
    expect(await screen.findByText('Not covered')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    await waitFor(() =>
      expect(store.values.find((value) => value.optionFieldId === 'den_limit')?.value).toBe(0),
    );
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

