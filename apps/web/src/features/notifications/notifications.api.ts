/**
 * React Query hooks for THE BELL: the leads, newest activity first.
 *
 * Polled every half minute while the admin is open, because a lead is a
 * visitor who is on the website right now, and an employee who calls within
 * the hour is the one who wins the business. Marking one seen refreshes
 * the feed and the customer it belongs to, which shows the same lead.
 */

import type { LeadDto, NotificationFeedDto } from '@aggregator/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { customerKeys } from '@/features/customers/customers.api';

export const notificationKeys = {
  feed: ['notifications', 'feed'] as const,
};

/** How often the bell asks again, in milliseconds. */
export const NOTIFICATION_POLL_MS = 30_000;

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.feed,
    queryFn: () => api.get<NotificationFeedDto>('/notifications'),
    refetchInterval: NOTIFICATION_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

function useFeedMutation<TResult, TInput>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, unknown, TInput>({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export function useMarkNotificationSeen() {
  return useFeedMutation<LeadDto, string>((id) =>
    api.post<LeadDto>(`/notifications/${id}/seen`, {}),
  );
}

export function useMarkAllNotificationsSeen() {
  return useFeedMutation<NotificationFeedDto, void>(() =>
    api.post<NotificationFeedDto>('/notifications/seen', {}),
  );
}
