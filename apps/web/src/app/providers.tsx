import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui';

/**
 * Application-wide providers. Future providers (authentication, permissions,
 * toasts) are added here so `main.tsx` stays a one-liner.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      /**
       * `npm run dev` starts the API and the web server together, and the API
       * needs several seconds longer (TypeScript boot plus the first database
       * connection). Queries fired in that window are refused, so retry with
       * backoff long enough to cover it — otherwise the first page load fails
       * permanently and the app looks like it has no data.
       */
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
