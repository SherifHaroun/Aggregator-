/**
 * THE CUSTOMER SITE.
 *
 * A visitor lands on the home page, compares, and sees the best three plans
 * in each tier. Opening one asks them to sign in with their name, email and
 * phone; that writes them down as a customer the employees can see, sends
 * them on to the plan, and what they save is in their cart — and in the
 * admin's. The admin area itself is behind a staff sign-in.
 *
 * Every test starts from an EMPTY store, signed in as nobody unless said.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/config/routes';
import { writeSessionToken } from '@/lib/session-store';
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
  writeSessionToken(null);
});

/** One individual plan from one insurer, priced flat and with the ceiling given. */
function givenPlan(id: string, name: string, annualLimit: number, annualPrice: number) {
  if (!store.companies.some((company) => company.id === 'company_arope')) {
    store.companies.push({
      id: 'company_arope',
      name: 'Arope',
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
  }
  store.plans.push({
    id: `plan_${id}`,
    companyId: 'company_arope',
    customerType: 'INDIVIDUAL',
    name,
    code: id.toUpperCase(),
    description: null,
    averageAge: { value: null, source: 'NOT_SPECIFIED', label: null },
    medicalNetworkId: null,
    isActive: true,
    ...timestamps,
  });
  store.configurations.push({
    id: `cfg_${id}`,
    planId: `plan_${id}`,
    geographicalCoverage: 'LOCAL',
    roomType: null,
    priceBands: [{ id: `band_${id}`, ageFrom: 0, ageTo: 120, annualPrice }],
    currency: 'EGP',
    annualLimit,
    deductible: null,
    coPayment: null,
    isActive: true,
    ...timestamps,
  });
}

const results = `${ROUTES.public.results}?customerTypeId=INDIVIDUAL&ageFrom=30&ageTo=30`;

describe('the front door', () => {
  it('opens on the customer site, with a way in at the top right', async () => {
    renderApp(ROUTES.home, 'anonymous');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Confused\?/ }),
    ).toBeInTheDocument();
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('link', { name: /Log in \/ Sign up/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Compare$/ })).toBeInTheDocument();
    /* No employee furniture on the customer site. */
    expect(screen.queryByRole('link', { name: 'Customers' })).not.toBeInTheDocument();
  });

  it('keeps the admin area behind a staff sign-in, and lets staff through', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.customers.list, 'anonymous');
    expect(await screen.findByRole('heading', { name: 'Employee sign in' })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Work email/), 'info@hadbrok.com');
    await user.type(screen.getByLabelText(/^Password/), 'HADBROK123');
    await user.click(screen.getByRole('button', { name: /Sign in to the admin area/ }));

    /* On to the page that was asked for, inside the admin shell. */
    expect(await screen.findByRole('heading', { name: 'Customers' })).toBeInTheDocument();
    expect(screen.getAllByText(/Signed in as/).length).toBeGreaterThan(0);
  });

  it('turns a customer away from the admin area', async () => {
    givenCustomerOnRecord('customer_mona', 'Mona Adel');
    renderApp(ROUTES.dashboard, { customerId: 'customer_mona' });
    expect(await screen.findByText(/You are signed in as Mona Adel/)).toBeInTheDocument();
  });
});

function givenCustomerOnRecord(id: string, name: string) {
  store.customers.push({
    id,
    name,
    source: 'WEBSITE',
    phone: '0100 000 0000',
    email: `${id}@example.com`,
    ...timestamps,
  });
}

describe('comparing as a visitor', () => {
  it('shows the best three in each tier, flagged, and asks for a sign-in to open one', async () => {
    const user = userEvent.setup();
    givenPlan('bronze', 'Bronze', 30_000, 2_000);
    givenPlan('silver', 'Silver', 60_000, 3_000);
    givenPlan('gold', 'Gold', 150_000, 5_000);
    givenPlan('platinum', 'Platinum', 200_000, 7_000);
    givenPlan('diamond', 'Diamond', 300_000, 9_000);
    givenPlan('crown', 'Crown', 400_000, 12_000);

    renderApp(results, 'anonymous');
    await screen.findByRole('heading', { level: 1, name: /best plans for you/ });

    /** Three tiers, each headed and each holding at most three. */
    const basic = screen.getByRole('region', { name: /Basic plans/ });
    const standard = screen.getByRole('region', { name: /Standard plans/ });
    const premium = screen.getByRole('region', { name: /Premium plans/ });
    expect(within(basic).getAllByRole('listitem')).toHaveLength(1);
    expect(within(basic).getByText('Bronze')).toBeInTheDocument();
    expect(within(standard).getAllByRole('listitem')).toHaveLength(1);
    expect(within(premium).getAllByRole('listitem')).toHaveLength(3);
    expect(within(premium).queryByText('Crown')).not.toBeInTheDocument();
    expect(within(premium).getByText(/Best value · Premium/)).toBeInTheDocument();
    expect(within(premium).getByText('Gold')).toBeInTheDocument();

    /** Not signed in: the button says so and leads to the door, remembering the plan. */
    const open = within(premium).getByRole('link', { name: 'View details for Gold' });
    expect(open).toHaveTextContent('Sign in to view details');
    expect(open).toHaveAttribute('href', expect.stringContaining(`${ROUTES.public.login}?next=`));
    await user.click(open);
    expect(await screen.findByRole('heading', { name: 'Welcome to Hadbrok' })).toBeInTheDocument();

    /** Name, email, phone — and they are on record for the employees, from the website. */
    await user.type(screen.getByLabelText(/Full name/), 'Mona Adel');
    await user.type(screen.getByLabelText(/^Email/), 'mona@example.com');
    await user.type(screen.getByLabelText(/Phone number/), '0100 123 4567');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(store.customers.map((c) => [c.name, c.source])).toEqual([['Mona Adel', 'WEBSITE']]),
    );

    /** Straight on to the plan they chose, in full. */
    expect(await screen.findByRole('heading', { level: 1, name: 'Gold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download PDF/ })).toBeInTheDocument();

    /** Saving it puts it in THEIR cart, which the corner counts. */
    await user.click(screen.getByRole('button', { name: /Save to my cart/ }));
    await waitFor(() => expect(store.cartItems).toHaveLength(1));
    expect(store.cartItems[0]).toMatchObject({
      customerId: store.customers[0]!.id,
      planConfigurationId: 'cfg_gold',
      name: 'Arope Individual 1',
    });
    await waitFor(() => expect(screen.getByTestId('my-cart-count')).toHaveTextContent('1'));
    expect(await screen.findByRole('link', { name: /Saved · View my cart/ })).toBeInTheDocument();

    /** And the cart page lists it with the customer's own words. */
    await user.click(screen.getByRole('link', { name: /Saved · View my cart/ }));
    expect(await screen.findByRole('heading', { name: /Mona Adel’s plans/ })).toBeInTheDocument();
    expect(screen.getByText('Arope Individual 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose this plan/ })).toBeInTheDocument();
  });

  it('opens a plan straight away for a customer who is already signed in', async () => {
    givenPlan('gold', 'Gold', 150_000, 5_000);
    givenCustomerOnRecord('customer_mona', 'Mona Adel');
    renderApp(results, { customerId: 'customer_mona' });
    const open = await screen.findByRole('link', { name: 'View details for Gold' });
    expect(open).toHaveTextContent('View details');
    expect(open).toHaveAttribute('href', expect.stringContaining(ROUTES.public.plan('cfg_gold')));
  });
});
