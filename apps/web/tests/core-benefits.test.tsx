/**
 * THE SIX CORE AREAS, AS THE NEW EDITOR ASKS FOR THEM.
 *
 * A core area is worth ONE figure, quoted a way the business fixes rather than
 * the employee chooses: in-patient and out-patient as a share of the bill,
 * maternity, dental, optical and chronic cover as a ceiling. Everything else a
 * plan says about an area is a detail line, read when somebody opens the plan
 * rather than when plans are ranked against each other.
 */

import { CORE_MEDICAL_BENEFITS, type InsuranceOptionDto } from '@aggregator/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/config/routes';
import { createStore, installFakeApi, type FakeStore } from './fake-api';
import { renderApp } from './render';

let store: FakeStore;
const originalFetch = globalThis.fetch;

const timestamps = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

/** The way each area is quoted, and therefore what its box is called. */
const AREAS = [
  { label: 'In-patient', field: 'Coverage', dataType: 'PERCENTAGE' as const },
  { label: 'Out-patient', field: 'Coverage', dataType: 'PERCENTAGE' as const },
  { label: 'Maternity', field: 'Limit', dataType: 'CURRENCY' as const },
  { label: 'Dental', field: 'Limit', dataType: 'CURRENCY' as const },
  { label: 'Optical', field: 'Limit', dataType: 'CURRENCY' as const },
  { label: 'Chronic / Pre-existing Conditions', field: 'Limit', dataType: 'CURRENCY' as const },
];

/** One catalogue record per core area, each carrying the figure its area uses. */
function givenCoreCatalogue() {
  for (const [index, area] of AREAS.entries()) {
    const id = `core_${index}`;
    store.options.push({
      id,
      name: area.label,
      description: null,
      sortOrder: index,
      isUmbrella: false,
      parentId: null,
      isActive: true,
      ...timestamps,
      fields: [
        {
          id: `${id}_value`,
          optionId: id,
          label: area.field,
          key: area.dataType === 'CURRENCY' ? 'limit' : 'percentage',
          dataType: area.dataType,
          unit: area.dataType === 'PERCENTAGE' ? '%' : null,
          helpText: null,
          isRequired: false,
          isOptional: false,
          sortOrder: 0,
          isActive: true,
          ...timestamps,
        },
      ],
    } as InsuranceOptionDto);
  }
}

function givenVariant() {
  store.companies.push({
    id: 'company_1',
    name: 'Northwind',
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
  store.plans.push({
    id: 'plan_1',
    companyId: 'company_1',
    customerType: 'INDIVIDUAL',
    name: 'Gold+',
    code: 'GOLD-INDIVIDUAL',
    description: null,
    averageAge: { value: null, source: 'NOT_SPECIFIED', label: null },
    isActive: true,
    ...timestamps,
  });
  store.configurations.push({
    id: 'cfg_1',
    planId: 'plan_1',
    geographicalCoverage: 'LOCAL',
    medicalNetworkId: null,
    roomType: null,
    priceBands: [{ id: 'band_1', ageFrom: 18, ageTo: 64, annualPrice: 7000 }],
    currency: 'EGP',
    annualLimit: 600000,
    deductible: null,
    coPayment: null,
    isActive: true,
    ...timestamps,
  });
  return 'cfg_1';
}

beforeEach(() => {
  store = installFakeApi(createStore());
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('the six core areas', () => {
  it('are always asked for, with the kind each is quoted in fixed', async () => {
    givenCoreCatalogue();
    const configurationId = givenVariant();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));
    await screen.findByRole('region', { name: 'Core benefits' });

    /**
     * Every area, whether or not the plan says anything about it — a blank
     * box and an absent section are different statements, and a comparison
     * reads all six.
     */
    for (const area of AREAS) {
      expect(await screen.findByLabelText(`${area.label} ${area.field}`)).toBeInTheDocument();
    }

    // Nothing to choose: the way an area is quoted is not per plan.
    expect(screen.queryByLabelText(/How .* is quoted/i)).not.toBeInTheDocument();
    // And nothing to press before a figure can be typed.
    const core = within(screen.getByRole('region', { name: 'Core benefits' }));
    expect(core.queryByRole('button', { name: /^Add$/ })).not.toBeInTheDocument();
  });

  it('matches the kinds the business fixed', () => {
    /**
     * The screen reads these from the shared configuration, so this is what
     * stops a rename here quietly changing what a plan is asked for.
     */
    const kinds = Object.fromEntries(
      CORE_MEDICAL_BENEFITS.map((benefit) => [benefit.name, benefit.valueKind]),
    );
    expect(kinds).toEqual({
      'In-patient': 'PERCENTAGE',
      'Out-patient': 'PERCENTAGE',
      Maternity: 'LIMIT',
      Dental: 'LIMIT',
      Optical: 'LIMIT',
      'Chronic / Pre-existing Conditions': 'LIMIT',
    });
  });

  it('saves each area against the right benefit, and reads them back', async () => {
    const user = userEvent.setup();
    givenCoreCatalogue();
    const configurationId = givenVariant();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    const entered: Record<string, string> = {
      'In-patient Coverage': '100',
      'Out-patient Coverage': '90',
      'Maternity Limit': '40000',
      'Dental Limit': '5000',
      'Optical Limit': '3000',
      'Chronic / Pre-existing Conditions Limit': '60000',
    };
    for (const [label, value] of Object.entries(entered)) {
      await user.type(await screen.findByLabelText(label), value);
    }
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => expect(store.values).toHaveLength(6));

    /** Each figure sits on the record for its own area, on THIS variant. */
    const stored = new Map(
      store.values.map((value) => {
        const planOption = store.planOptions.find((row) => row.id === value.planOptionId)!;
        const option = store.options.find((item) => item.id === planOption.optionId)!;
        return [option.name, value.value];
      }),
    );
    expect(stored.get('In-patient')).toBe(100);
    expect(stored.get('Out-patient')).toBe(90);
    expect(stored.get('Maternity')).toBe(40000);
    expect(stored.get('Dental')).toBe(5000);
    expect(stored.get('Optical')).toBe(3000);
    expect(stored.get('Chronic / Pre-existing Conditions')).toBe(60000);

    for (const planOption of store.planOptions) {
      expect(planOption.planConfigurationId).toBe(configurationId);
    }
  });

  it('treats a typed 0 as the plan declining the area', async () => {
    const user = userEvent.setup();
    givenCoreCatalogue();
    const configurationId = givenVariant();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.type(await screen.findByLabelText('Maternity Limit'), '0');
    await user.type(await screen.findByLabelText('Dental Limit'), '0');

    /**
     * Said on the screen as it is typed. A 0 is not the weakest cover — it is
     * no cover, and reading it as a small figure would rank a plan that
     * refuses dental above one that never mentioned it.
     */
    expect(await screen.findAllByText('Not covered')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    await waitFor(() => expect(store.values).toHaveLength(2));
    expect(store.values.every((value) => value.value === 0)).toBe(true);
  });

  it('keeps a detail line against the variant, beside the figure', async () => {
    const user = userEvent.setup();
    givenCoreCatalogue();
    const configurationId = givenVariant();

    renderApp(ROUTES.configurations.detail('company_1', 'plan_1', configurationId));

    await user.type(await screen.findByLabelText('Dental Limit'), '5000');

    /** One row per area, in the order the business fixed; dental is the fourth. */
    const core = within(screen.getByRole('region', { name: 'Core benefits' }));
    const rows = core.getAllByRole('button', { name: /Add detail/i });
    expect(rows).toHaveLength(AREAS.length);
    await user.click(rows[AREAS.findIndex((area) => area.label === 'Dental')]!);

    // Named for its own area, which is how we know the right row opened.
    await user.type(await screen.findByLabelText('Dental detail 1'), 'Includes orthodontics');

    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    /**
     * The detail qualifies the figure; it does not replace it, and it belongs
     * to this variant rather than to the benefit everyone shares.
     */
    await waitFor(() => {
      const dental = store.planOptions.find((row) => row.optionId === 'core_3');
      expect(dental?.note).toBe('Includes orthodontics');
    });
    expect(store.values.find((value) => value.value === 5000)).toBeDefined();
  });
});
