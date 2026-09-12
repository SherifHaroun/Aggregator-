/**
 * CUSTOMERS AND THEIR CARTS.
 *
 * A caller is written down with a name and whatever else they give; the
 * comparisons run for them are kept in their cart, named by the system
 * ("Arope Individual 1", then 2), numbered down the left, dated, with a note
 * underneath; the cart in the corner counts every comparison waiting and
 * opens onto the customers who have one; and the green button links the plan
 * the customer settled on — one at a time.
 *
 * Every test starts from an EMPTY store. The names are invented here.
 */

import { screen, waitFor, within } from '@testing-library/react';
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

/** One insurer with one individual plan, priced at 4,000 for every age. */
function givenAropeSilverOnSale() {
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
  store.plans.push({
    id: 'plan_silver',
    companyId: 'company_arope',
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
    id: 'cfg_silver',
    planId: 'plan_silver',
    geographicalCoverage: 'LOCAL',
    roomType: null,
    priceBands: [{ id: 'band_1', ageFrom: 0, ageTo: 120, annualPrice: 4_000 }],
    currency: 'EGP',
    annualLimit: 300_000,
    deductible: null,
    coPayment: null,
    isActive: true,
    ...timestamps,
  });
}

function givenCustomer(id: string, name: string, phone: string | null = null) {
  store.customers.push({ id, name, phone, email: null, ...timestamps });
  return id;
}

/** A comparison already in the cart, as the fake would have written it. */
function givenCartItem(customerId: string, sequence: number, note: string | null = null) {
  const id = `cart_${customerId}_${sequence}`;
  store.cartItems.push({
    id,
    customerId,
    name: `Arope Individual ${sequence}`,
    nameSequence: sequence,
    note,
    planConfigurationId: 'cfg_silver',
    planId: 'plan_silver',
    companyId: 'company_arope',
    companyName: 'Arope',
    planName: 'Silver',
    customerTypeId: 'INDIVIDUAL',
    annualPrice: 4_000,
    currency: 'EGP',
    criteria: { customerTypeId: 'INDIVIDUAL', ageFrom: 30, ageTo: 30 },
    isChosen: false,
    chosenAt: null,
    createdAt: new Date(sequence * 60_000).toISOString(),
  });
  return id;
}

const results = `${ROUTES.comparison.results}?customerTypeId=INDIVIDUAL&ageFrom=30&ageTo=30`;

describe('customers', () => {
  it('writes a caller down with a name alone, and opens their empty cart', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.customers.list);
    await screen.findByRole('heading', { name: 'Customers' });

    await user.click(screen.getByRole('button', { name: /Add customer/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add a customer' });
    await user.type(within(dialog).getByLabelText(/^Name/), 'Mona Adel');
    await user.type(within(dialog).getByLabelText(/Phone number/), '0100 123 4567');
    await user.click(within(dialog).getByRole('button', { name: 'Add customer' }));

    /** On the list, with her number and an empty cart. */
    expect(await screen.findByText('Mona Adel')).toBeInTheDocument();
    expect(screen.getByText('0100 123 4567')).toBeInTheDocument();
    expect(screen.getByText('Empty cart')).toBeInTheDocument();
    expect(store.customers.map((customer) => customer.name)).toEqual(['Mona Adel']);

    await user.click(screen.getByRole('link', { name: /View cart/ }));
    expect(await screen.findByRole('heading', { name: 'Mona Adel' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing kept yet/)).toBeInTheDocument();
  });

  it('is sidebar navigation, and the cart in the corner starts at nothing', async () => {
    renderApp(ROUTES.dashboard);
    expect((await screen.findAllByRole('link', { name: 'Customers' })).length).toBeGreaterThan(0);
    expect((await screen.findAllByTestId('cart-count'))[0]).toHaveTextContent('0');
  });
});

describe('keeping a comparison for a customer', () => {
  it('names it for the insurer and section, numbers it, and counts it in the corner', async () => {
    const user = userEvent.setup();
    givenAropeSilverOnSale();
    givenCustomer('customer_mona', 'Mona Adel', '0100 123 4567');
    givenCustomer('customer_omar', 'Omar Said');

    renderApp(results);
    await screen.findByRole('heading', { name: 'Comparison results' });
    await screen.findByText(/1 matching plan/);

    /** From the top of the results, for Mona, with a note. */
    await user.click(screen.getByRole('button', { name: /Add to customer cart/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add to customer cart' });
    await user.click(await within(dialog).findByRole('radio', { name: /Mona Adel/ }));
    await user.type(within(dialog).getByLabelText(/^Note/), 'Wants a private room');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(store.cartItems).toHaveLength(1));
    expect(store.cartItems[0]).toMatchObject({
      customerId: 'customer_mona',
      name: 'Arope Individual 1',
      note: 'Wants a private room',
      planConfigurationId: 'cfg_silver',
      criteria: { customerTypeId: 'INDIVIDUAL', ageFrom: 30, ageTo: 30 },
    });

    /** The corner counts it; opening it shows Mona, and Mona shows the entry. */
    await waitFor(() =>
      expect(screen.getAllByTestId('cart-count').map((el) => el.textContent)).toContain('1'),
    );
    const cartButtons = screen.getAllByRole('button', { name: /Customer cart, 1 comparison/ });
    await user.click(cartButtons[0]!);
    const panel = await screen.findByRole('dialog', { name: 'Customer carts' });
    expect(within(panel).queryByText('Omar Said')).not.toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: /Mona Adel/ }));
    const list = within(panel).getByRole('list', { name: /Mona Adel.*cart/ });
    expect(within(list).getByText('Arope Individual 1')).toBeInTheDocument();
    expect(within(list).getByText('Wants a private room')).toBeInTheDocument();
    expect(within(list).getByText(/Silver · Arope/)).toBeInTheDocument();

    /** A second Arope comparison for the same customer is number 2. */
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /Add to customer cart/ }));
    const again = screen.getByRole('dialog', { name: 'Add to customer cart' });
    await user.click(await within(again).findByRole('radio', { name: /Mona Adel/ }));
    await user.click(within(again).getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(store.cartItems.map((item) => item.name)).toEqual([
        'Arope Individual 1',
        'Arope Individual 2',
      ]),
    );
  });

  it('adds a caller who is not on the list yet, without leaving the results', async () => {
    const user = userEvent.setup();
    givenAropeSilverOnSale();

    renderApp(results);
    await screen.findByText(/1 matching plan/);
    await user.click(screen.getByRole('button', { name: /Add to customer cart/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add to customer cart' });
    await user.click(within(dialog).getByRole('button', { name: /New customer/ }));
    await user.type(within(dialog).getByLabelText(/^Name/), 'Nour Hassan');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(store.cartItems).toHaveLength(1));
    expect(store.customers.map((customer) => customer.name)).toEqual(['Nour Hassan']);
    expect(store.cartItems[0]?.customerId).toBe(store.customers[0]?.id);
  });
});

describe('the cart on the customer page', () => {
  it('numbers the comparisons first to last, links one at a time, and removes', async () => {
    const user = userEvent.setup();
    givenAropeSilverOnSale();
    givenCustomer('customer_mona', 'Mona Adel');
    givenCartItem('customer_mona', 1, 'First call');
    givenCartItem('customer_mona', 2);

    renderApp(ROUTES.customers.detail('customer_mona'));
    await screen.findByRole('heading', { name: 'Mona Adel' });
    expect(screen.getByText(/2 comparisons in the cart/)).toBeInTheDocument();

    const list = screen.getByRole('list', { name: /Mona Adel.*cart/ });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('1');
    expect(rows[0]).toHaveTextContent('Arope Individual 1');
    expect(rows[0]).toHaveTextContent('First call');
    expect(rows[1]).toHaveTextContent('Arope Individual 2');
    /** Each opens the comparison it was run from. */
    expect(within(rows[0]!).getByRole('link', { name: /Open comparison/ })).toHaveAttribute(
      'href',
      expect.stringContaining('customerTypeId=INDIVIDUAL'),
    );

    /** The green button links the first; linking the second moves the tick. */
    await user.click(within(rows[0]!).getByRole('button', { name: /Link to customer/ }));
    expect(await within(rows[0]!).findByText('Linked to customer')).toBeInTheDocument();
    expect(await screen.findByText(/linked to Arope Individual 1/)).toBeInTheDocument();

    await user.click(within(rows[1]!).getByRole('button', { name: /Link to customer/ }));
    await waitFor(() =>
      expect(store.cartItems.map((item) => item.isChosen)).toEqual([false, true]),
    );
    expect(await within(rows[1]!).findByText('Linked to customer')).toBeInTheDocument();
    expect(within(rows[0]!).queryByText('Linked to customer')).not.toBeInTheDocument();

    /** Removing the first leaves the second, now numbered 1 on the page. */
    await user.click(within(rows[0]!).getByRole('button', { name: 'Remove Arope Individual 1' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(store.cartItems).toHaveLength(1));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByText(/1 comparison in the cart/)).toBeInTheDocument();
  });
});
