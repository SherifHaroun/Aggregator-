/**
 * ASKING FOR THE BEST PLAN WITHOUT CHOOSING ANYTHING ELSE.
 *
 * One question has to be answered — who is being insured — and the rest may
 * be left to the system. What matters is that the screen sends only what was
 * answered, so the engine's standard assumptions apply, and that the results
 * name every assumption rather than passing it off as the customer's choice.
 */

import {
  ANY_COVERAGE_LABEL,
  DEFAULT_COMPARISON_AGE,
  type ComparisonRequestInput,
} from '@aggregator/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/config/routes';
import { createStore, installFakeApi, type FakeStore } from './fake-api';
import { renderApp } from './render';

let store: FakeStore;
const originalFetch = globalThis.fetch;

/** Every comparison the screen asked for, in order. */
let requested: ComparisonRequestInput[];

const timestamps = { createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };

/** One individual plan, priced across three bands, in the only currency on record. */
function givenAnIndividualPlanOnSale() {
  store.companies.push({
    id: 'company_1',
    name: 'Northwind Assurance',
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
    name: 'Silver',
    code: 'SILVER',
    description: null,
    averageAge: { value: null, source: 'NOT_SPECIFIED', label: null },
    medicalNetworkId: null,
    isActive: true,
    ...timestamps,
  });
  store.configurations.push({
    id: 'cfg_1',
    planId: 'plan_1',
    geographicalCoverage: 'LOCAL',
    roomType: null,
    priceBands: [
      { id: 'band_1', ageFrom: 0, ageTo: 17, annualPrice: 2_000 },
      { id: 'band_2', ageFrom: 18, ageTo: 64, annualPrice: 4_000 },
      { id: 'band_3', ageFrom: 65, ageTo: 120, annualPrice: 7_500 },
    ],
    currency: 'EGP',
    annualLimit: 300_000,
    deductible: null,
    coPayment: null,
    isActive: true,
    ...timestamps,
  });
}

beforeEach(() => {
  store = installFakeApi(createStore());
  requested = [];

  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/comparison') && (init?.method ?? 'GET').toUpperCase() === 'POST') {
      requested.push(JSON.parse(String(init?.body)) as ComparisonRequestInput);
    }
    return inner(input as RequestInfo, init);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('working it out for me', () => {
  it('runs on who is being insured, and nothing else', async () => {
    const user = userEvent.setup();
    givenAnIndividualPlanOnSale();

    renderApp(ROUTES.comparison.new);
    await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });
    await user.click(screen.getByRole('radio', { name: /Individual/i }));
    await user.click(screen.getByRole('button', { name: /Work it out for me/i }));

    /**
     * ONLY the customer type travels. No age, no coverage, no currency, no
     * budget — every one of them is the engine's to fill, and sending a
     * guess from the screen would make it the customer's answer instead.
     */
    await waitFor(() => expect(requested).not.toHaveLength(0));
    expect(requested.at(-1)).toEqual({ customerTypeId: 'INDIVIDUAL' });
  });

  it('will not work it out for nobody', async () => {
    const user = userEvent.setup();
    givenAnIndividualPlanOnSale();

    renderApp(ROUTES.comparison.new);
    await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });
    await user.click(screen.getByRole('button', { name: /Work it out for me/i }));

    // A company's three books are three products; "best plan" needs a buyer.
    expect(await screen.findByText('Select who you want to insure.')).toBeInTheDocument();
    expect(requested).toHaveLength(0);
  });

  it('names every assumption on the results', async () => {
    const user = userEvent.setup();
    givenAnIndividualPlanOnSale();

    renderApp(ROUTES.comparison.new);
    await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });
    await user.click(screen.getByRole('radio', { name: /Individual/i }));
    await user.click(screen.getByRole('button', { name: /Work it out for me/i }));

    /**
     * The age, the coverage and the currency were all ours. Each is marked
     * as such: an assumption that is not named reads as something the
     * customer chose, and a premium at age 35 handed to a 60-year-old as
     * "their" price is a mis-sale.
     */
    expect(await screen.findByText(`Age ${DEFAULT_COMPARISON_AGE} (assumed)`)).toBeInTheDocument();
    expect(screen.getByText(ANY_COVERAGE_LABEL)).toBeInTheDocument();
    expect(screen.getByText('EGP (assumed)')).toBeInTheDocument();
    expect(screen.getByText(/Worked out for you:/i)).toBeInTheDocument();

    // And the premium shown is the one at the assumed age.
    expect(screen.getAllByText('EGP 4,000').length).toBeGreaterThan(0);
  });

  it('compares with every other question left blank', async () => {
    const user = userEvent.setup();
    givenAnIndividualPlanOnSale();

    renderApp(ROUTES.comparison.new);
    await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });
    await user.click(screen.getByRole('radio', { name: /Family/i }));

    // The long way round, answering nothing else. Same outcome.
    await user.click(screen.getByRole('button', { name: /Compare Plans/i }));

    await waitFor(() => expect(requested).not.toHaveLength(0));
    const request = requested.at(-1)!;
    expect(request.customerTypeId).toBe('FAMILY');
    expect(request.ageFrom).toBeUndefined();
    expect(request.ageTo).toBeUndefined();
    expect(request.geographicalCoverageId).toBeUndefined();
    expect(screen.queryByText(/Enter the age/i)).not.toBeInTheDocument();
  });

  it('still refuses an age that is not an age', async () => {
    const user = userEvent.setup();
    givenAnIndividualPlanOnSale();

    renderApp(ROUTES.comparison.new);
    await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });
    await user.click(screen.getByRole('radio', { name: /Individual/i }));
    await user.type(screen.getByLabelText(/^Age/), '250');
    await user.click(screen.getByRole('button', { name: /Compare Plans/i }));

    // Blank is allowed; wrong is not.
    expect(await screen.findByText(/Enter a whole age between/i)).toBeInTheDocument();
    expect(requested).toHaveLength(0);
  });
});
