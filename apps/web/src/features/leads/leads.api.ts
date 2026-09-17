/**
 * React Query hooks for LEADS: what a visitor to the customer site does.
 *
 * Three writes and one read, none of them signed in: leave your details,
 * open a plan, choose one, and read the lead back. Each write hands back
 * the whole lead at its new stage, which the results and the plan pages
 * keep so they know what has already been opened.
 */

import type { CreateLeadInput, LeadDto, LeadPlanInput } from '@aggregator/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { rememberLead } from './lead-session';

export const leadKeys = {
  detail: (id: string) => ['leads', 'detail', id] as const,
};

export function useLead(id: string | null) {
  return useQuery({
    queryKey: leadKeys.detail(id ?? ''),
    queryFn: () => api.get<LeadDto>(`/leads/${id}`),
    enabled: id !== null,
    staleTime: 60_000,
  });
}

function useLeadMutation<TInput>(mutationFn: (input: TInput) => Promise<LeadDto>) {
  const queryClient = useQueryClient();
  return useMutation<LeadDto, unknown, TInput>({
    mutationFn,
    onSuccess: (lead) => {
      queryClient.setQueryData(leadKeys.detail(lead.id), lead);
      rememberLead(lead);
    },
  });
}

/** The one final step: the visitor becomes a lead, and a customer. */
export function useCreateLead() {
  return useLeadMutation<CreateLeadInput>((input) => api.post<LeadDto>('/leads', input));
}

/** The visitor opened a plan in full; the PDF goes to their inbox. */
export function useRecordPlanView() {
  return useLeadMutation<{ leadId: string } & LeadPlanInput>(({ leadId, ...input }) =>
    api.post<LeadDto>(`/leads/${leadId}/views`, input),
  );
}

/** The visitor chose a plan: into their cart, PDF sent, a call to come. */
export function useChoosePlan() {
  return useLeadMutation<{ leadId: string } & LeadPlanInput>(({ leadId, ...input }) =>
    api.post<LeadDto>(`/leads/${leadId}/choice`, input),
  );
}
