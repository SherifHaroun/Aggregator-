/**
 * Employee data-management interface.
 *
 * Every test starts from an EMPTY store and creates records through the real
 * UI, against a fake API that speaks the real contract. No record here reaches
 * any database — this is test scaffolding, not seed data.
 *
 * The benefit names used below are invented inside the tests on purpose: they
 * prove the interface works for anything an employee creates, and the
 * application code never mentions them.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/config/routes';
import { createStore, installFakeApi, type FakeStore } from './fake-api';
import { renderApp } from './render';

let store: FakeStore;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  store = installFakeApi(createStore());
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// (13) Empty states
// ---------------------------------------------------------------------------

describe('empty states', () => {
  it('invites the employee to add the first company', async () => {
    renderApp(ROUTES.companies.list);
    expect(await screen.findByText('No insurance companies yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Add your first insurance company to start building/i),
    ).toBeInTheDocument();
  });

  it('shows an empty state for insurance types, plans and options', async () => {
    renderApp(ROUTES.insuranceTypes.list);
    expect(await screen.findByText('No insurance types yet')).toBeInTheDocument();

    renderApp(ROUTES.plans.list);
    expect(await screen.findByText('No plans yet')).toBeInTheDocument();

    renderApp(ROUTES.insuranceOptions.list);
    expect(await screen.findByText('No insurance options yet')).toBeInTheDocument();
  });

  it('renders no example records anywhere', async () => {
    renderApp(ROUTES.companies.list);
    await screen.findByText('No insurance companies yet');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(store.companies).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (1) (2) Companies
// ---------------------------------------------------------------------------

describe('companies', () => {
  it('creates a company through the form', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.companies.new);

    await user.type(await screen.findByLabelText(/Company name/i), 'Acme Underwriters');
    await user.type(screen.getByLabelText(/Short name/i), 'ACME');
    await user.type(screen.getByLabelText(/^Email/i), 'contact@example.test');
    await user.click(screen.getByRole('button', { name: /Save company/i }));

    await waitFor(() => expect(store.companies).toHaveLength(1));
    expect(store.companies[0]).toMatchObject({
      name: 'Acme Underwriters',
      shortName: 'ACME',
      email: 'contact@example.test',
      isActive: true,
    });
  });

  it('edits an existing company', async () => {
    const user = userEvent.setup();
    store.companies.push({
      id: 'company_x',
      name: 'Original Name',
      shortName: null,
      logoUrl: null,
      description: null,
      website: null,
      email: null,
      phone: null,
      mobile: null,
      address: null,
      isActive: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });

    renderApp(ROUTES.companies.edit('company_x'));

    const nameInput = await screen.findByLabelText(/Company name/i);
    await waitFor(() => expect(nameInput).toHaveValue('Original Name'));

    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Company');
    await user.click(screen.getByRole('button', { name: /Save company/i }));

    await waitFor(() => expect(store.companies[0]?.name).toBe('Renamed Company'));
  });

  // (14) Validation errors
  it('shows the API validation message on the offending field', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.companies.new);

    // Submitting with no name makes the fake API answer VALIDATION_ERROR.
    await user.click(await screen.findByRole('button', { name: /Save company/i }));

    expect(await screen.findByText(/Please correct the highlighted fields/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/String must contain at least 1 character/i),
    ).toBeInTheDocument();
    expect(store.companies).toHaveLength(0);
  });

  // (15) API errors
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
    expect(
      screen.getByText(/database is not available right now/i),
    ).toBeInTheDocument();
    // No technical detail leaks through.
    expect(screen.queryByText(/Prisma/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// (3) Insurance types
// ---------------------------------------------------------------------------

describe('insurance types', () => {
  it('creates an insurance type from the dialog', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.insuranceTypes.list);

    await user.click(await screen.findByRole('button', { name: /Add insurance type/i }));
    await user.type(await screen.findByLabelText(/Insurance type name/i), 'Household Cover');
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => expect(store.insuranceTypes).toHaveLength(1));
    expect(store.insuranceTypes[0]?.name).toBe('Household Cover');
  });
});

// ---------------------------------------------------------------------------
// (4) (5) Plans and configurations
// ---------------------------------------------------------------------------

/** Seeds the fake store directly, to reach a screen without retyping earlier steps. */
function givenCompanyAndType() {
  store.companies.push({
    id: 'company_1',
    name: 'Test Company',
    shortName: null,
    logoUrl: null,
    description: null,
    website: null,
    email: null,
    phone: null,
    mobile: null,
    address: null,
    isActive: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });
  store.insuranceTypes.push({
    id: 'type_1',
    name: 'Test Insurance Type',
    code: 'test_insurance_type',
    description: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });
}

describe('plans and configurations', () => {
  it('creates a plan without any price field', async () => {
    const user = userEvent.setup();
    givenCompanyAndType();
    renderApp(ROUTES.plans.new);

    // The selects are populated from the API, so wait for the options to arrive.
    await screen.findByRole('option', { name: 'Test Company' });
    await screen.findByRole('option', { name: 'Test Insurance Type' });
    await user.selectOptions(screen.getByLabelText(/Company/i), 'company_1');
    await user.selectOptions(screen.getByLabelText(/Insurance type/i), 'type_1');
    await user.type(screen.getByLabelText(/Plan name/i), 'Tier One');
    await user.type(screen.getByLabelText(/Plan code/i), 'TIER-1');

    // A plan is the product: pricing belongs to its configurations.
    expect(screen.queryByLabelText(/Annual price/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save plan/i }));
    await waitFor(() => expect(store.plans).toHaveLength(1));
    expect(store.plans[0]).toMatchObject({ name: 'Tier One', code: 'TIER-1' });
  });

  it('creates a configuration and shows the SME average age from the central rule', async () => {
    const user = userEvent.setup();
    givenCompanyAndType();
    store.plans.push({
      id: 'plan_1',
      companyId: 'company_1',
      insuranceTypeId: 'type_1',
      name: 'Tier One',
      code: 'TIER-1',
      description: null,
      category: null,
      isActive: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });

    renderApp(ROUTES.planConfigurations.new('plan_1'));

    // No age input for SME — the rule supplies it.
    await user.click(await screen.findByRole('radio', { name: /SME/i }));
    expect(await screen.findByText(/Average age: 35/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/average age/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Local/i }));
    await user.type(screen.getByLabelText(/Currency/i), 'EGP');
    await user.type(screen.getByLabelText(/Annual price/i), '12000');
    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    await waitFor(() => expect(store.configurations).toHaveLength(1));
    expect(store.configurations[0]).toMatchObject({
      customerType: 'SME',
      geographicalCoverage: 'LOCAL',
      annualPrice: 12000,
    });
  });
});

// ---------------------------------------------------------------------------
// (6) (7) (12) Dynamic options and fields
// ---------------------------------------------------------------------------

describe('dynamic insurance options', () => {
  it('creates an option and then its fields, with no code knowing their names', async () => {
    const user = userEvent.setup();
    givenCompanyAndType();
    renderApp(ROUTES.insuranceOptions.new);

    await user.type(await screen.findByLabelText(/Option name/i), 'Aurora Wellness Programme');
    await user.selectOptions(screen.getByLabelText(/Insurance type/i), 'type_1');
    await user.click(screen.getByRole('button', { name: /Save option/i }));

    await waitFor(() => expect(store.options).toHaveLength(1));

    // The app navigates to the option's own screen, where fields are defined.
    await screen.findByText('No fields yet');

    for (const [label, dataType] of [
      ['Coverage Percentage', 'Percentage'],
      ['Annual Limit', 'Amount'],
      ['Maximum Sessions', 'Number'],
    ] as const) {
      await user.click(screen.getAllByRole('button', { name: /Add field/i })[0]!);
      await user.type(await screen.findByLabelText(/Field label/i), label);
      await user.selectOptions(screen.getByLabelText(/Data type/i), dataType);
      await user.click(screen.getByRole('button', { name: /Save field/i }));
      await waitFor(() => expect(screen.queryByLabelText(/Field label/i)).not.toBeInTheDocument());
    }

    expect(store.options[0]?.fields?.map((field) => field.label)).toEqual([
      'Coverage Percentage',
      'Annual Limit',
      'Maximum Sessions',
    ]);
  });
});

// ---------------------------------------------------------------------------
// (8) (9) (10) (11) Attaching options and entering values
// ---------------------------------------------------------------------------

/** Creates a plan, one configuration, and an option with three fields. */
function givenConfigurationWithCatalogue(customerType: 'INDIVIDUAL' | 'FAMILY' = 'INDIVIDUAL') {
  givenCompanyAndType();
  store.plans.push({
    id: 'plan_1',
    companyId: 'company_1',
    insuranceTypeId: 'type_1',
    name: 'Tier One',
    code: 'TIER-1',
    description: null,
    category: null,
    isActive: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });

  const timestamps = { createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };

  // An option invented for this test, with a field shape the code never anticipates.
  store.options.push({
    id: 'option_1',
    insuranceTypeId: 'type_1',
    name: 'Aurora Wellness Programme',
    description: null,
    sortOrder: 0,
    isActive: true,
    ...timestamps,
    fields: [
      { id: 'field_coverage', optionId: 'option_1', label: 'Coverage Percentage', key: 'coverage_percentage', dataType: 'PERCENTAGE', unit: null, helpText: null, isRequired: false, sortOrder: 0, isActive: true, ...timestamps },
      { id: 'field_limit', optionId: 'option_1', label: 'Annual Limit', key: 'annual_limit', dataType: 'CURRENCY', unit: null, helpText: null, isRequired: false, sortOrder: 1, isActive: true, ...timestamps },
      { id: 'field_sessions', optionId: 'option_1', label: 'Maximum Sessions', key: 'maximum_sessions', dataType: 'NUMBER', unit: null, helpText: null, isRequired: false, sortOrder: 2, isActive: true, ...timestamps },
    ],
  });
  store.options.push({
    id: 'option_2',
    insuranceTypeId: 'type_1',
    name: 'Zenith Travel Assistance',
    description: null,
    sortOrder: 1,
    isActive: true,
    ...timestamps,
    fields: [
      { id: 'field_available', optionId: 'option_2', label: 'Available', key: 'available', dataType: 'BOOLEAN', unit: null, helpText: null, isRequired: false, sortOrder: 0, isActive: true, ...timestamps },
      { id: 'field_provider', optionId: 'option_2', label: 'Provider', key: 'provider', dataType: 'TEXT', unit: null, helpText: null, isRequired: false, sortOrder: 1, isActive: true, ...timestamps },
    ],
  });

  const configurationId = `configuration_${customerType}`;
  store.configurations.push({
    id: configurationId,
    planId: 'plan_1',
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
  return configurationId;
}

describe('attaching benefits to a configuration', () => {
  it('adds a benefit and renders the fields its definition declares', async () => {
    const user = userEvent.setup();
    const configurationId = givenConfigurationWithCatalogue();
    renderApp(ROUTES.planConfigurations.detail(configurationId));

    // Catalogue shows both employee-created benefits.
    expect(await screen.findByText('Aurora Wellness Programme')).toBeInTheDocument();
    expect(screen.getByText('Zenith Travel Assistance')).toBeInTheDocument();

    // fireEvent rather than user.click: userEvent's pointer emulation does not
    // reach buttons inside a dnd-kit draggable under jsdom, which has no layout.
    // The real pointer path is verified in a browser instead.
    fireEvent.click(screen.getByRole('button', { name: 'Add Aurora Wellness Programme' }));

    // The value form is generated from the field definitions.
    expect(await screen.findByLabelText('Coverage Percentage')).toBeInTheDocument();
    expect(store.planOptions).toHaveLength(1);
    expect(screen.getByLabelText('Annual Limit')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum Sessions')).toBeInTheDocument();
  });

  it('renders a different benefit with a completely different field shape', async () => {
    const user = userEvent.setup();
    const configurationId = givenConfigurationWithCatalogue();
    store.planOptions.push({
      id: 'planOption_2',
      planConfigurationId: configurationId,
      optionId: 'option_2',
      sortOrder: 0,
    });

    renderApp(ROUTES.planConfigurations.detail(configurationId));

    // Boolean renders as a Yes/No select, text as a text box — driven by dataType.
    const available = await screen.findByLabelText('Available');
    expect(available.tagName).toBe('SELECT');
    expect(screen.getByLabelText('Provider').tagName).toBe('INPUT');

    await user.selectOptions(available, 'true');
    await user.type(screen.getByLabelText('Provider'), 'Any network clinic');
    await user.click(screen.getByRole('button', { name: 'Save Zenith Travel Assistance' }));

    await waitFor(() => expect(store.values).toHaveLength(2));
    expect(store.values.find((value) => value.optionFieldId === 'field_available')?.value).toBe(true);
    expect(store.values.find((value) => value.optionFieldId === 'field_provider')?.value).toBe(
      'Any network clinic',
    );
  });

  it('saves the entered values against the right configuration', async () => {
    const user = userEvent.setup();
    const configurationId = givenConfigurationWithCatalogue();
    store.planOptions.push({
      id: 'planOption_1',
      planConfigurationId: configurationId,
      optionId: 'option_1',
      sortOrder: 0,
    });

    renderApp(ROUTES.planConfigurations.detail(configurationId));

    await user.type(await screen.findByLabelText('Coverage Percentage'), '80');
    await user.type(screen.getByLabelText('Annual Limit'), '50000');
    await user.type(screen.getByLabelText('Maximum Sessions'), '20');
    await user.click(screen.getByRole('button', { name: 'Save Aurora Wellness Programme' }));

    await waitFor(() => expect(store.values).toHaveLength(3));
    expect(store.values.map((value) => value.value)).toEqual([80, 50000, 20]);
    expect(store.values.every((value) => value.planOptionId === 'planOption_1')).toBe(true);
  });

  // (11) Different configurations keep different values
  it('keeps each configuration’s values separate', async () => {
    const user = userEvent.setup();
    const individual = givenConfigurationWithCatalogue('INDIVIDUAL');

    // A second configuration of the SAME plan, for a different customer type.
    store.configurations.push({
      ...store.configurations[0]!,
      id: 'configuration_FAMILY',
      customerType: 'FAMILY',
      annualPrice: 15000,
    });

    store.planOptions.push(
      { id: 'planOption_individual', planConfigurationId: individual, optionId: 'option_1', sortOrder: 0 },
      { id: 'planOption_family', planConfigurationId: 'configuration_FAMILY', optionId: 'option_1', sortOrder: 0 },
    );

    // Configure the individual one.
    const first = renderApp(ROUTES.planConfigurations.detail(individual));
    await user.type(await screen.findByLabelText('Coverage Percentage'), '80');
    await user.click(screen.getByRole('button', { name: 'Save Aurora Wellness Programme' }));
    await waitFor(() => expect(store.values).toHaveLength(3));
    first.unmount();

    // Configure the family one differently.
    renderApp(ROUTES.planConfigurations.detail('configuration_FAMILY'));
    await user.type(await screen.findByLabelText('Coverage Percentage'), '90');
    await user.click(screen.getByRole('button', { name: 'Save Aurora Wellness Programme' }));
    await waitFor(() => expect(store.values).toHaveLength(6));

    const coverageFor = (planOptionId: string) =>
      store.values.find(
        (value) => value.planOptionId === planOptionId && value.optionFieldId === 'field_coverage',
      )?.value;

    expect(coverageFor('planOption_individual')).toBe(80);
    expect(coverageFor('planOption_family')).toBe(90);
  });

  /**
   * (9) Reordering.
   *
   * jsdom reports zero-sized rects, so dnd-kit cannot resolve a pointer drop
   * target. This covers the two halves that are testable here: the drag handles
   * the board renders, and the reorder endpoint the board calls on drop.
   */
  it('renders drag handles and persists a new benefit order', async () => {
    const configurationId = givenConfigurationWithCatalogue();
    store.planOptions.push(
      { id: 'planOption_a', planConfigurationId: configurationId, optionId: 'option_1', sortOrder: 0 },
      { id: 'planOption_b', planConfigurationId: configurationId, optionId: 'option_2', sortOrder: 1 },
    );

    renderApp(ROUTES.planConfigurations.detail(configurationId));

    // Both benefits expose a keyboard-reachable drag handle.
    expect(
      await screen.findByRole('button', { name: /Reorder Aurora Wellness Programme/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Reorder Zenith Travel Assistance/i }),
    ).toBeInTheDocument();

    // Reordering writes through the API and updates sortOrder.
    await fetch('/api/v1/plan-configurations/' + configurationId + '/options/reorder', {
      method: 'POST',
      body: JSON.stringify({ orderedIds: ['planOption_b', 'planOption_a'] }),
    });

    expect(store.planOptions.find((item) => item.id === 'planOption_b')?.sortOrder).toBe(0);
    expect(store.planOptions.find((item) => item.id === 'planOption_a')?.sortOrder).toBe(1);
  });
});
