/**
 * WHO IS SIGNED IN, and signing in and out.
 *
 * The session is one query keyed on the token: when the token changes the
 * query changes, so a sign-in is felt everywhere at once. A token the server
 * no longer honours — expired, or signed under a rotated secret — is
 * dropped quietly, and the visitor is simply nobody again.
 */

import type {
  AdminLoginInput,
  CustomerLoginInput,
  LoginResultDto,
  SessionDto,
} from '@aggregator/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { ApiError, api } from '@/lib/api-client';
import { readSessionToken, subscribeToSessionToken, writeSessionToken } from '@/lib/session-store';

export const authKeys = {
  session: (token: string | null) => ['auth', 'session', token] as const,
};

export function useSessionToken(): string | null {
  return useSyncExternalStore(subscribeToSessionToken, readSessionToken, () => null);
}

export function useSession() {
  const token = useSessionToken();
  return useQuery({
    queryKey: authKeys.session(token),
    queryFn: async (): Promise<SessionDto | null> => {
      if (!token) return null;
      try {
        return await api.get<SessionDto>('/auth/session');
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          writeSessionToken(null);
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
    /**
     * A second screen mounting while the check has failed must not start it
     * again: the gate would read the restarted check as "still checking",
     * unmount that screen, and the two would chase each other forever.
     */
    retryOnMount: false,
  });
}

/** The signed-in customer, or `null` for staff and strangers alike. */
export function useCustomerSession() {
  const session = useSession();
  return {
    ...session,
    customer: session.data?.kind === 'customer' ? session.data.customer : null,
  };
}

function useSignIn<TInput>(path: string) {
  const queryClient = useQueryClient();
  return useMutation<LoginResultDto, unknown, TInput>({
    mutationFn: (input) => api.post<LoginResultDto>(path, input),
    onSuccess: (result) => {
      /* Everything cached was somebody else's view: start again as them. */
      queryClient.clear();
      queryClient.setQueryData(authKeys.session(result.token), result.session);
      writeSessionToken(result.token);
    },
  });
}

export function useAdminSignIn() {
  return useSignIn<AdminLoginInput>('/auth/admin/login');
}

export function useCustomerSignIn() {
  return useSignIn<CustomerLoginInput>('/auth/customer/login');
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    writeSessionToken(null);
    queryClient.clear();
  }, [queryClient]);
}
