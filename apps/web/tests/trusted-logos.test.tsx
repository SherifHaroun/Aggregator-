/**
 * TRUSTED BY.
 *
 * Two endless streams of logos on the home page: the insurers the admin keeps
 * on record, and the companies across Egypt the broker looks after. jsdom has
 * no layout or animation, so the motion is checked in the browser; here, what
 * a screen reader gets — each name once, not once per copy of the loop — and
 * that nothing asks to be clicked: no arrows, no pause.
 */

import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CLIENTS, TrustedLogos } from '@/features/public/TrustedLogos';
import { writeSessionToken } from '@/lib/session-store';
import { createStore, installFakeApi, type FakeStore } from './fake-api';

let store: FakeStore;
const originalFetch = globalThis.fetch;
const timestamps = { createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };

function givenInsurer(id: string, name: string, logoUrl: string | null) {
  store.companies.push({
    id,
    name,
    shortName: null,
    logoUrl,
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

function preferReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrustedLogos />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  store = installFakeApi(createStore());
  writeSessionToken(null);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllGlobals();
});

describe('trusted logos', () => {
  it('streams the insurers on record above the companies, each name heard once', async () => {
    preferReducedMotion(false);
    givenInsurer('company_axa', 'AXA', '/uploads/axa.png');
    givenInsurer('company_arope', 'Arope', null);
    renderSection();

    const insurers = await screen.findByRole('heading', { name: 'Trusted insurance providers' });
    const companies = screen.getByRole('heading', {
      name: 'Trusted by leading companies across Egypt',
    });
    expect(
      insurers.compareDocumentPosition(companies) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const [insurerList, companyList, ...copies] = screen.getAllByRole('list');
    expect(copies).toHaveLength(0);
    expect(await within(insurerList!).findByRole('img', { name: 'AXA' })).toBeInTheDocument();
    // No logo uploaded yet: the name, set in type.
    expect(within(insurerList!).getByText('Arope')).toBeInTheDocument();
    expect(within(companyList!).getAllByRole('listitem')).toHaveLength(CLIENTS.length);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('leaves out the insurer row when there are no insurers', async () => {
    preferReducedMotion(false);
    renderSection();

    await vi.waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Trusted insurance providers' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { name: 'Trusted by leading companies across Egypt' }),
    ).toBeInTheDocument();
  });

  it('holds still for visitors who prefer reduced motion', async () => {
    preferReducedMotion(true);
    givenInsurer('company_axa', 'AXA', '/uploads/axa.png');
    renderSection();

    await screen.findByRole('img', { name: 'AXA' });
    const lists = screen.getAllByRole('list');
    expect(lists).toHaveLength(2);
    // One still copy of each row, nothing duplicated for a loop.
    expect(document.querySelectorAll('[aria-hidden="true"] li')).toHaveLength(0);
  });
});
