import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';
import { routes } from '@/app/router';
import { writeSessionToken } from '@/lib/session-store';
import { ADMIN_TOKEN } from './fake-api';

/**
 * Mount the real route map at a given path, with real providers.
 *
 * Uses `useRoutes` inside a `MemoryRouter` rather than a data router: the app
 * declares no loaders or actions, and the data router builds a `Request` whose
 * `AbortSignal` jsdom rejects.
 *
 * Retries are off and caching disabled so tests observe each request directly.
 */
function AppRoutes() {
  return useRoutes(routes);
}

/**
 * Who the test is signed in as. Staff by default — most tests are about the
 * employee's screens — or nobody at all, which is every visitor to the
 * customer site: there are no customer accounts.
 */
export type RenderAs = 'staff' | 'anonymous';

export function renderApp(initialPath: string, as: RenderAs = 'staff') {
  writeSessionToken(as === 'staff' ? ADMIN_TOKEN : null);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppRoutes />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}
