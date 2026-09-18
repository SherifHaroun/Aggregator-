/**
 * THE CUSTOMER SITE.
 *
 * A visitor lands on the home page and compares — SME only, the other lines
 * are coming soon. Before the results they leave their details: that is a
 * lead, and a customer the employees can see. The results show the best
 * three in each tier; opening one notes it on the lead and sends the PDF;
 * choosing one puts it in their cart as their choice, sends the PDF again,
 * and says so. Nobody signs in. The admin is behind its own door.
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
  window.sessionStorage.clear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  writeSessionToken(null);
});

/** One SME plan from one insurer, priced flat and with the ceiling given. */
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
    customerType: 'SME',
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

const criteria = 'customerTypeId=SME&employees=30%E2%80%9334%3A6';
const results = `${ROUTES.public.results}?${criteria}`;

describe('the front door', () => {
  it('opens on the customer site, with no sign-in anywhere and only SME on sale', async () => {
    renderApp(ROUTES.home, 'anonymous');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Confused\?/ }),
    ).toBeInTheDocument();
    const header = within(screen.getByRole('banner'));
    expect(header.queryByRole('link', { name: /Log in/ })).not.toBeInTheDocument();
    expect(header.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Compare$/ })).toBeInTheDocument();

    /** Individual and Family are drawn, greyed, and cannot be picked. */
    const who = screen.getByRole('group', { name: 'Who do you want to insure?' });
    expect(within(who).getByRole('radio', { name: /SME/ })).toBeChecked();
    expect(within(who).getByRole('radio', { name: /Individual/ })).toBeDisabled();
    expect(within(who).getByRole('radio', { name: /Family/ })).toBeDisabled();
    expect(within(who).getAllByText('Coming soon')).toHaveLength(2);

    /* No employee furniture on the customer site. */
    expect(screen.queryByRole('link', { name: 'Customers' })).not.toBeInTheDocument();
  });

  it('keeps the admin area behind its own door, and lets the broker’s account through', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.customers.list, 'anonymous');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    /** Staff only: there is nothing to sign up for. */
    expect(screen.queryByRole('tab', { name: 'Sign up' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Email/), 'info@hadbrok.com');
    await user.type(screen.getByLabelText(/^Password/), 'HADBROK123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    /* On to the page that was asked for, inside the admin shell. */
    expect(await screen.findByRole('heading', { name: 'Customers' })).toBeInTheDocument();
    expect(screen.getAllByText(/Signed in as/).length).toBeGreaterThan(0);
  });

  it('keeps every company page on this site', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.home, 'anonymous');
    await screen.findByRole('heading', { level: 1, name: /Confused\?/ });

    const footer = within(screen.getByRole('contentinfo'));
    for (const link of footer.getAllByRole('link')) {
      expect(link).not.toHaveAttribute('href', expect.stringContaining('hadbrok.com/'));
    }
    expect(footer.getByText(/Individual · coming soon/)).toBeInTheDocument();

    await user.click(footer.getByRole('link', { name: 'About us' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /insurance broker since 1982/ }),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Contact us' }),
    );
    expect(await screen.findByRole('heading', { name: 'Careers' })).toBeInTheDocument();
  });
});

describe('comparing as a visitor', () => {
  it('asks for the visitor’s details before the results, and writes them down as a customer', async () => {
    const user = userEvent.setup();
    givenPlan('gold', 'Gold', 150_000, 5_000);

    /** Straight to the results without a lead: sent to the one final step. */
    renderApp(results, 'anonymous');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Your best plans/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('One final step')).toBeInTheDocument();

    /** Nothing goes out without a name and a way to reach them. */
    await user.click(screen.getByRole('button', { name: /Show my results/ }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(store.leads).toHaveLength(0);

    await user.type(screen.getByLabelText(/First name/), 'Mona');
    await user.type(screen.getByLabelText(/Last name/), 'Adel');
    await user.type(screen.getByLabelText(/Mobile number/), '+20 100 000 0000');
    await user.type(screen.getByLabelText(/^Email/), 'mona@example.com');
    await user.type(screen.getByLabelText(/Company/), 'Mona Trading');
    await user.click(screen.getByRole('button', { name: /Show my results/ }));

    /** A lead, and a customer from the website, with what was typed. */
    await waitFor(() => expect(store.leads).toHaveLength(1));
    expect(store.leads[0]).toMatchObject({
      name: 'Mona Adel',
      email: 'mona@example.com',
      phone: '+20 100 000 0000',
      companyName: 'Mona Trading',
      stage: 'COMPARED',
      criteria: { customerTypeId: 'SME' },
    });
    expect(store.customers.map((c) => [c.name, c.source, c.companyName, c.phone])).toEqual([
      ['Mona Adel', 'WEBSITE', 'Mona Trading', '+20 100 000 0000'],
    ]);

    /** And the results, addressed to them. */
    expect(
      await screen.findByRole('heading', { level: 1, name: /best plan for you/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Your results, Mona')).toBeInTheDocument();
  });

  it('shows the best three in each tier, notes what is opened, and sends the chosen plan', async () => {
    const user = userEvent.setup();
    givenPlan('bronze', 'Bronze', 30_000, 2_000);
    givenPlan('silver', 'Silver', 60_000, 3_000);
    givenPlan('gold', 'Gold', 150_000, 5_000);
    givenPlan('platinum', 'Platinum', 200_000, 7_000);
    givenPlan('diamond', 'Diamond', 300_000, 9_000);
    givenPlan('crown', 'Crown', 400_000, 12_000);
    givenLead('lead_mona');

    renderApp(`${results}&lead=lead_mona`, 'anonymous');
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

    /** Opening a plan: no door in the way, and the lead says which was opened. */
    const open = within(premium).getByRole('link', { name: 'View details for Gold' });
    expect(open).toHaveTextContent('View details');
    expect(open).toHaveAttribute('href', expect.stringContaining('lead=lead_mona'));
    await user.click(open);
    expect(await screen.findByRole('heading', { level: 1, name: 'Gold' })).toBeInTheDocument();
    await waitFor(() =>
      expect(store.leads[0]!.views.map((view) => [view.planName, view.emailStatus])).toEqual([
        ['Gold', 'SENT'],
      ]),
    );
    expect(store.leads[0]!.stage).toBe('VIEWED');
    expect(await screen.findByText(/The PDF of this plan is in your inbox/)).toBeInTheDocument();
    /** The PDF is in their inbox; there is no second copy to download here. */
    expect(screen.queryByRole('button', { name: /Download PDF/ })).not.toBeInTheDocument();

    /** Choosing it: into the cart as the choice, the PDF sent, and the page says so. */
    await user.click(screen.getByRole('button', { name: /Choose this plan/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Your plan is on its way/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /The plan PDF has been sent to your email, and one of our team will contact you within 24 hours/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Arope · Gold')).toBeInTheDocument();

    expect(store.cartItems).toHaveLength(1);
    expect(store.cartItems[0]).toMatchObject({
      customerId: 'customer_mona',
      planConfigurationId: 'cfg_gold',
      name: 'Arope SME 1',
      isChosen: true,
      note: 'Chosen on the website.',
    });
    expect(store.leads[0]).toMatchObject({
      stage: 'CHOSEN',
      seenAt: null,
      choice: { planName: 'Gold', cartItemId: store.cartItems[0]!.id, emailStatus: 'SENT' },
    });
  });

  it('says so honestly when the server could not email the PDF', async () => {
    const user = userEvent.setup();
    givenPlan('gold', 'Gold', 150_000, 5_000);
    givenLead('lead_mona');
    store.emailOutcome = 'NOT_CONFIGURED';

    renderApp(`${ROUTES.public.plan('cfg_gold')}?${criteria}&lead=lead_mona`, 'anonymous');
    await screen.findByRole('heading', { level: 1, name: 'Gold' });
    await user.click(await screen.findByRole('button', { name: /Choose this plan/ }));

    expect(
      await screen.findByRole('heading', { level: 1, name: /Your plan is chosen/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We could not send the PDF to your email just now/),
    ).toBeInTheDocument();
    expect(store.cartItems[0]?.isChosen).toBe(true);
  });
});

/** A visitor who has already left their details this visit. */
function givenLead(id: string) {
  store.customers.push({
    id: 'customer_mona',
    name: 'Mona Adel',
    source: 'WEBSITE',
    phone: '+20 100 000 0000',
    email: 'mona@example.com',
    companyName: 'Mona Trading',
    ...timestamps,
  });
  store.leads.push({
    id,
    customerId: 'customer_mona',
    firstName: 'Mona',
    lastName: 'Adel',
    name: 'Mona Adel',
    email: 'mona@example.com',
    phone: '+20 100 000 0000',
    companyName: 'Mona Trading',
    criteria: { customerTypeId: 'SME', smeEmployees: { '30–34': 6 } },
    stage: 'COMPARED',
    views: [],
    choice: null,
    createdAt: timestamps.createdAt,
    lastActivityAt: timestamps.createdAt,
    seenAt: null,
  });
}
