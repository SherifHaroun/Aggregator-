/**
 * THE EMPLOYEE'S BELL.
 *
 * A lead is a notification: one line per visit to the customer site, saying
 * the last thing the visitor did. When the admin opens and there is
 * something new, the panel slides in on its own — once per tab, and only
 * unless the employee has turned that off in the panel's settings. Opening
 * a row marks it seen and leads to the customer, whose page tells the
 * whole story of the visit.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LeadDto } from '@aggregator/shared';
import { ROUTES } from '@/config/routes';
import { writeSessionToken } from '@/lib/session-store';
import { createStore, installFakeApi, type FakeStore } from './fake-api';
import { renderApp } from './render';

let store: FakeStore;
const originalFetch = globalThis.fetch;
const at = (minute: number) => new Date(Date.UTC(2026, 8, 18, 9, minute)).toISOString();

beforeEach(() => {
  store = installFakeApi(createStore());
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  writeSessionToken(null);
});

function givenLead(overrides: Partial<LeadDto> & { id: string; name: string }): LeadDto {
  const [firstName = 'Mona', lastName = 'Adel'] = overrides.name.split(' ');
  const customerId = `customer_${overrides.id}`;
  store.customers.push({
    id: customerId,
    name: overrides.name,
    source: 'WEBSITE',
    phone: '+20 100 000 0000',
    email: `${overrides.id}@example.com`,
    companyName: 'Mona Trading',
    createdAt: at(0),
    updatedAt: at(0),
  });
  const lead: LeadDto = {
    customerId,
    firstName,
    lastName,
    email: `${overrides.id}@example.com`,
    phone: '+20 100 000 0000',
    companyName: 'Mona Trading',
    criteria: { customerTypeId: 'SME' },
    stage: 'COMPARED',
    views: [],
    choice: null,
    createdAt: at(0),
    lastActivityAt: at(0),
    seenAt: null,
    ...overrides,
  };
  store.leads.push(lead);
  return lead;
}

describe('the bell', () => {
  it('slides in on arrival when there is something new, newest activity first, and says what each visitor last did', async () => {
    givenLead({ id: 'a', name: 'Mona Adel', lastActivityAt: at(1) });
    givenLead({
      id: 'b',
      name: 'Omar Farid',
      stage: 'CHOSEN',
      lastActivityAt: at(5),
      choice: {
        cartItemId: null,
        planConfigurationId: 'cfg_gold',
        companyName: 'Arope',
        planName: 'Gold',
        annualPrice: 12_000,
        currency: 'EGP',
        emailStatus: 'SENT',
        emailedAt: at(5),
        chosenAt: at(5),
      },
    });
    givenLead({
      id: 'c',
      name: 'Sara Nabil',
      stage: 'VIEWED',
      lastActivityAt: at(3),
      seenAt: at(4),
      views: [
        {
          planConfigurationId: 'cfg_silver',
          planId: 'plan_silver',
          companyId: 'company_arope',
          companyName: 'AXA',
          planName: 'Silver',
          customerTypeId: 'SME',
          annualPrice: 8_000,
          currency: 'EGP',
          emailStatus: 'NOT_CONFIGURED',
          emailedAt: null,
          viewedAt: at(3),
        },
      ],
    });

    renderApp(ROUTES.dashboard);

    /** Two are new; the panel opened by itself. */
    const panel = await screen.findByTestId('notification-panel');
    expect(screen.getAllByTestId('notification-count')[0]).toHaveTextContent('2');
    expect(within(panel).getByText(/2 new leads from the website/)).toBeInTheDocument();

    const rows = within(panel).getAllByTestId('notification');
    expect(rows.map((row) => row.getAttribute('data-unseen'))).toEqual(['true', 'false', 'true']);
    expect(rows[0]).toHaveTextContent('Omar Farid chose Arope · Gold');
    expect(rows[0]).toHaveTextContent('12,000 EGP / year');
    expect(rows[0]).toHaveTextContent('PDF sent');
    expect(rows[0]).toHaveTextContent('Chose a plan');
    expect(rows[1]).toHaveTextContent('Sara Nabil viewed AXA · Silver');
    expect(rows[1]).toHaveTextContent('PDF not sent (email not set up)');
    expect(rows[2]).toHaveTextContent('Mona Adel compared plans');
  });

  it('opens a row onto the customer, marked seen, and marks everything seen at once', async () => {
    const user = userEvent.setup();
    givenLead({ id: 'a', name: 'Mona Adel', lastActivityAt: at(1) });
    givenLead({ id: 'b', name: 'Omar Farid', lastActivityAt: at(2) });

    renderApp(ROUTES.dashboard);
    const panel = await screen.findByTestId('notification-panel');

    await user.click(within(panel).getByText('Mona Adel compared plans'));
    expect(await screen.findByRole('heading', { name: 'Mona Adel' })).toBeInTheDocument();
    /** The customer's page tells the same story. */
    expect(screen.getByText('Website activity')).toBeInTheDocument();
    expect(await screen.findByTestId('lead')).toHaveTextContent('Mona Adel compared plans');
    await waitFor(() => expect(store.leads.find((lead) => lead.id === 'a')?.seenAt).not.toBeNull());
    expect(store.leads.find((lead) => lead.id === 'b')?.seenAt).toBeNull();
    await waitFor(() =>
      expect(screen.getAllByTestId('notification-count')[0]).toHaveTextContent('1'),
    );

    /** The bell opens the panel again; "mark all" clears the count. */
    await user.click(screen.getAllByTestId('notification-bell')[0]!);
    await user.click(
      within(await screen.findByTestId('notification-panel')).getByRole('button', {
        name: /Mark all as seen/,
      }),
    );
    await waitFor(() => expect(store.leads.every((lead) => lead.seenAt !== null)).toBe(true));
    await waitFor(() =>
      expect(screen.getAllByTestId('notification-count')[0]).toHaveTextContent('0'),
    );
  });

  it('stays closed on arrival once the employee has turned the greeting off, and once per tab otherwise', async () => {
    const user = userEvent.setup();
    givenLead({ id: 'a', name: 'Mona Adel', lastActivityAt: at(1) });

    const first = renderApp(ROUTES.dashboard);
    const panel = await screen.findByTestId('notification-panel');
    await user.click(within(panel).getByRole('button', { name: 'Notification settings' }));
    await user.click(
      within(panel).getByRole('checkbox', { name: /Open this panel when I arrive/ }),
    );
    expect(window.localStorage.getItem('hadbrok.notifications.autoOpen')).toBe('off');
    first.unmount();

    /** Same tab, greeting off: the bell still counts, the panel stays put. */
    window.sessionStorage.clear();
    renderApp(ROUTES.dashboard);
    await waitFor(() =>
      expect(screen.getAllByTestId('notification-count')[0]).toHaveTextContent('1'),
    );
    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
  });
});
