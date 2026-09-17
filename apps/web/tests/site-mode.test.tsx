/**
 * ONE BUILD, TWO SITES, DEPLOYED APART.
 *
 * `VITE_SITE_MODE` decides which tree a deployment serves. A customer-only
 * build has no `/admin` at all; an admin-only build sends its root straight
 * to the dashboard door. Both are the same route map with one half left
 * out — never two codebases.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRoutes } from '@/app/router';
import { ToastProvider } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { writeSessionToken } from '@/lib/session-store';
import { createStore, installFakeApi } from './fake-api';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  installFakeApi(createStore());
  writeSessionToken(null);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mount(path: string, mode: { customer: boolean; admin: boolean }) {
  function Routes() {
    return useRoutes(buildRoutes(mode));
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('site modes', () => {
  it('serves both trees by default', async () => {
    mount(ROUTES.home, { customer: true, admin: true });
    expect(
      await screen.findByRole('heading', { level: 1, name: /Confused\?/ }),
    ).toBeInTheDocument();
  });

  it('has no admin on a customer-only build', async () => {
    mount(ROUTES.login, { customer: true, admin: false });
    /** Not the door, not a redirect to it: the page simply is not here. */
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
  });

  it('opens an admin-only build on the dashboard door', async () => {
    mount(ROUTES.home, { customer: false, admin: true });
    /** Nobody signed in: the root leads to /admin, which leads to the door. */
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /Confused\?/ })).not.toBeInTheDocument();
  });
});
