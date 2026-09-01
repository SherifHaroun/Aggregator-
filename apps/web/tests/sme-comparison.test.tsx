/**
 * ASKING A BUSINESS WHO IT IS INSURING.
 *
 * A business has a workforce, not an age. This is the screen that asks for one,
 * and what matters about it is that it asks using the SAME bracket definitions
 * the premium is later worked out from — the twelve boxes drawn here and the
 * arithmetic that prices them are one source of truth, not two that happen to
 * agree today.
 */

import {
  SME_AGE_BRACKETS,
  SME_COMPARISON_AVERAGE_AGE,
  type ComparisonRequestInput,
} from '@aggregator/shared';
import { screen, waitFor, within } from '@testing-library/react';
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

function givenAnSmePlanOnSale() {
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
    customerType: 'SME',
    name: 'Gold+',
    code: 'GOLD-SME',
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
    priceBands: [{ id: 'band_1', ageFrom: 0, ageTo: 120, annualPrice: 4_000 }],
    currency: 'EGP',
    annualLimit: 600_000,
    deductible: null,
    coPayment: null,
    isActive: true,
    ...timestamps,
  });
}

/** Fill in the SME half of the form, leaving the workforce to the caller. */
async function chooseSme(user: ReturnType<typeof userEvent.setup>) {
  renderApp(ROUTES.comparison.new);
  await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });
  await user.click(screen.getByRole('radio', { name: /SME/i }));
  await user.click(screen.getByRole('radio', { name: /^Local$/i }));
}

beforeEach(() => {
  store = installFakeApi(createStore());
  requested = [];

  // Watch what the screen actually asks for, without changing what it gets.
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

describe('asking an SME who it insures', () => {
  it('draws one box per bracket, from the definitions that price them', async () => {
    const user = userEvent.setup();
    givenAnSmePlanOnSale();
    await chooseSme(user);

    await user.click(screen.getByRole('button', { name: /Edit ages/i }));

    /**
     * Twelve boxes named by the shared brackets — not by a list typed into this
     * screen. A copy here could drift from the one doing the arithmetic, and a
     * bracket that exists on the form but not in the pricing is an employee
     * silently costing nothing.
     */
    for (const bracket of SME_AGE_BRACKETS) {
      expect(screen.getByLabelText(`Employees aged ${bracket.label}`)).toBeInTheDocument();
    }
    expect(screen.getAllByLabelText(/^Employees aged /)).toHaveLength(12);
  });

  it('folds away, showing only how many employees the comparison is about', async () => {
    const user = userEvent.setup();
    givenAnSmePlanOnSale();
    await chooseSme(user);

    // Closed to begin with: twelve boxes is most of a screen, beside five
    // other questions.
    expect(screen.queryByLabelText('Employees aged 30–34')).not.toBeInTheDocument();
    expect(screen.getByText(/0 employees/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Edit ages/i }));
    await user.type(screen.getByLabelText('Employees aged 30–34'), '6');

    // The summary carries the answer once it is folded up again.
    await user.click(screen.getByRole('button', { name: /Done/i }));
    expect(screen.queryByLabelText('Employees aged 30–34')).not.toBeInTheDocument();
    expect(screen.getByText('6 employees')).toBeInTheDocument();
  });

  it('adds the brackets up as they are typed', async () => {
    const user = userEvent.setup();
    givenAnSmePlanOnSale();
    await chooseSme(user);
    await user.click(screen.getByRole('button', { name: /Edit ages/i }));

    await user.type(screen.getByLabelText('Employees aged 20–24'), '2');
    await user.type(screen.getByLabelText('Employees aged 25–29'), '4');
    await user.type(screen.getByLabelText('Employees aged 30–34'), '6');
    await user.type(screen.getByLabelText('Employees aged 35–39'), '5');
    await user.type(screen.getByLabelText('Employees aged 40–44'), '2');
    await user.type(screen.getByLabelText('Employees aged 45–49'), '1');

    expect(screen.getByText('Total: 20 employees')).toBeInTheDocument();
    expect(screen.getByText('20 employees')).toBeInTheDocument();
  });

  it('never asks a business for an age, nor shows it the one used', async () => {
    const user = userEvent.setup();
    givenAnSmePlanOnSale();
    await chooseSme(user);

    /**
     * The standard comparison age still decides which plans are sold to an
     * SME. It is an assumption about how the cover is quoted, not a statement
     * about this employer's staff — shown as "Average age 35" it would read as
     * the second, so it is not shown at all.
     */
    expect(screen.queryByLabelText(/^Age/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Average age/i)).not.toBeInTheDocument();
    expect(screen.queryByText(String(SME_COMPARISON_AVERAGE_AGE))).not.toBeInTheDocument();
  });

  it('will not compare a workforce of nobody', async () => {
    const user = userEvent.setup();
    givenAnSmePlanOnSale();
    await chooseSme(user);

    await user.click(screen.getByRole('button', { name: /Compare Plans/i }));

    /**
     * Zero employees priced at zero would make every plan free and tie them
     * all at the top — a comparison of nothing, presented as an answer.
     */
    expect(
      await screen.findByText(/Enter how many employees are in each age group/i),
    ).toBeInTheDocument();
    expect(requested).toHaveLength(0);
  });

  it('sends the workforce to be priced, and the standard age to match on', async () => {
    const user = userEvent.setup();
    givenAnSmePlanOnSale();
    await chooseSme(user);

    await user.click(screen.getByRole('button', { name: /Edit ages/i }));
    await user.type(screen.getByLabelText('Employees aged 30–34'), '6');
    await user.type(screen.getByLabelText('Employees aged 55–59'), '2');
    await user.click(screen.getByRole('button', { name: /Compare Plans/i }));

    await waitFor(() => expect(requested).not.toHaveLength(0));
    const request = requested.at(-1)!;

    /**
     * The two halves of an SME comparison, and they are different questions.
     * The headcounts PRICE the workforce; the standard age is what the plans
     * are matched on, and it is never derived from the headcounts — this
     * workforce averages well above 35 and the age travels as 35 regardless.
     */
    expect(request.smeEmployees).toEqual({ '30–34': 6, '55–59': 2 });
    expect(request.ageFrom).toBe(SME_COMPARISON_AVERAGE_AGE);
    expect(request.ageTo).toBe(SME_COMPARISON_AVERAGE_AGE);
    expect(request.customerTypeId).toBe('SME');
  });

  it('leaves the empty brackets out rather than sending eleven zeroes', async () => {
    const user = userEvent.setup();
    givenAnSmePlanOnSale();
    await chooseSme(user);

    await user.click(screen.getByRole('button', { name: /Edit ages/i }));
    await user.type(screen.getByLabelText('Employees aged 65+'), '3');
    await user.click(screen.getByRole('button', { name: /Compare Plans/i }));

    await waitFor(() => expect(requested).not.toHaveLength(0));

    // Nobody being 55–59 is the default; writing it down says no more.
    expect(requested.at(-1)!.smeEmployees).toEqual({ '65+': 3 });
  });

  it('asks an individual for an age and sends no workforce', async () => {
    const user = userEvent.setup();
    givenAnSmePlanOnSale();
    store.plans[0]!.customerType = 'INDIVIDUAL';

    renderApp(ROUTES.comparison.new);
    await screen.findByRole('heading', { name: 'Insurance plan', level: 1 });
    await user.click(screen.getByRole('radio', { name: /Individual/i }));
    await user.click(screen.getByRole('radio', { name: /^Local$/i }));

    // One person has one age, and no business to describe.
    expect(screen.queryByText('Employee ages')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Age/), '32');
    await user.click(screen.getByRole('button', { name: /Compare Plans/i }));

    await waitFor(() => expect(requested).not.toHaveLength(0));
    expect(requested.at(-1)!.smeEmployees).toBeUndefined();
    expect(requested.at(-1)!.ageFrom).toBe(32);
  });

  it('carries the workforce in the link, so a comparison can be sent on', async () => {
    const user = userEvent.setup();
    givenAnSmePlanOnSale();

    /**
     * Opened straight from a URL, with nothing typed. The results page reads
     * the same bracket ids back, which is what makes a comparison shareable.
     */
    renderApp(
      `${ROUTES.comparison.results}?customerTypeId=SME&geographicalCoverageId=LOCAL` +
        `&currency=EGP&ageFrom=35&ageTo=35&employees=30%E2%80%9334:6&employees=65%2B:1`,
    );

    await waitFor(() => expect(requested).not.toHaveLength(0));
    expect(requested.at(-1)!.smeEmployees).toEqual({ '30–34': 6, '65+': 1 });
    expect(user).toBeDefined();
  });

  it('ignores an age group somebody invented in the link', async () => {
    givenAnSmePlanOnSale();

    renderApp(
      `${ROUTES.comparison.results}?customerTypeId=SME&geographicalCoverageId=LOCAL` +
        `&currency=EGP&ageFrom=35&ageTo=35&employees=18%E2%80%9335:4&employees=30%E2%80%9334:6`,
    );

    await waitFor(() => expect(requested).not.toHaveLength(0));

    // A hand-written link cannot price against a bracket that does not exist.
    expect(requested.at(-1)!.smeEmployees).toEqual({ '30–34': 6 });
  });
});

describe('what an SME is shown back', () => {
  it('calls the figure an estimate, and says what it is based on', async () => {
    givenAnSmePlanOnSale();

    renderApp(
      `${ROUTES.comparison.results}?customerTypeId=SME&geographicalCoverageId=LOCAL` +
        `&currency=EGP&ageFrom=35&ageTo=35&employees=30%E2%80%9334:6`,
    );

    /**
     * It is a real calculation from a real rate table, and it is still built
     * on the workforce entered for comparison — so it is an estimate. Calling
     * it a final price would be a quote, and nobody has underwritten anything.
     */
    // Named on the plan card, and again as the row heading in the table.
    expect(await screen.findAllByText('Estimated annual price')).toHaveLength(2);
    expect(await screen.findByText(/Based on 6 employees/i)).toBeInTheDocument();
    expect(screen.queryByText(/Final price/i)).not.toBeInTheDocument();
    expect(screen.queryByText('per year')).not.toBeInTheDocument();
  });

  it('reports the workforce back instead of the age it matched on', async () => {
    givenAnSmePlanOnSale();

    renderApp(
      `${ROUTES.comparison.results}?customerTypeId=SME&geographicalCoverageId=LOCAL` +
        `&currency=EGP&ageFrom=35&ageTo=35&employees=30%E2%80%9334:6`,
    );

    await screen.findAllByText('Estimated annual price');

    // What the employer told us, not the assumption we applied to it.
    expect(screen.getByText('6 employees')).toBeInTheDocument();
    expect(screen.queryByText('Age 35')).not.toBeInTheDocument();
    expect(within).toBeDefined();
  });
});
