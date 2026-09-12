/**
 * React Query hooks for customers and their carts.
 *
 * Their own file rather than a corner of `insurance-data.api.ts`: a customer
 * is somebody the broker is talking to, not insurance data, and nothing
 * here needs to reach the plan or comparison caches.
 *
 * Every write refreshes every customer read — the list, the open customer
 * and the cart button all show the same carts, and keeping one of them
 * behind the others is exactly the kind of drift a cart count invites.
 */

import type {
  AddCartItemInput,
  CartSummaryDto,
  CustomerCartItemDto,
  CustomerDto,
  CustomerWithCartDto,
} from '@aggregator/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, query } from '@/lib/api-client';

export const customerKeys = {
  all: ['customers'] as const,
  list: (search: string) => ['customers', 'list', search] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
  cart: ['customers', 'cart'] as const,
};

export interface CustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export function useCustomers(search = '') {
  return useQuery({
    queryKey: customerKeys.list(search),
    queryFn: () => api.get<CustomerDto[]>(`/customers${query({ search })}`),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ''),
    queryFn: () => api.get<CustomerWithCartDto>(`/customers/${id}`),
    enabled: Boolean(id),
  });
}

/** Everything waiting in every cart, for the button in the corner. */
export function useCartSummary() {
  return useQuery({
    queryKey: customerKeys.cart,
    queryFn: () => api.get<CartSummaryDto>('/customers/cart'),
  });
}

function useCustomerMutation<TResult, TInput>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, unknown, TInput>({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export function useCreateCustomer() {
  return useCustomerMutation<CustomerDto, CustomerInput>((input) =>
    api.post<CustomerDto>('/customers', input),
  );
}

export function useSaveCustomer(id: string) {
  return useCustomerMutation<CustomerDto, CustomerInput>((input) =>
    api.patch<CustomerDto>(`/customers/${id}`, input),
  );
}

export function useDeleteCustomer() {
  return useCustomerMutation<void, string>((id) => api.delete<void>(`/customers/${id}`));
}

export function useAddCartItem() {
  return useCustomerMutation<CustomerCartItemDto, { customerId: string } & AddCartItemInput>(
    ({ customerId, ...input }) =>
      api.post<CustomerCartItemDto>(`/customers/${customerId}/cart`, input),
  );
}

export function useUpdateCartItem() {
  return useCustomerMutation<
    CustomerCartItemDto,
    { customerId: string; itemId: string; note?: string | null; chosen?: boolean }
  >(({ customerId, itemId, ...input }) =>
    api.patch<CustomerCartItemDto>(`/customers/${customerId}/cart/${itemId}`, input),
  );
}

export function useRemoveCartItem() {
  return useCustomerMutation<void, { customerId: string; itemId: string }>(
    ({ customerId, itemId }) => api.delete<void>(`/customers/${customerId}/cart/${itemId}`),
  );
}
