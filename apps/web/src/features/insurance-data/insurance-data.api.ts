/**
 * React Query hooks for every insurance-data resource.
 *
 * One file, because the resources share a single, uniform contract
 * (`Paginated<T>` lists, `PATCH` for edits including deactivation, `DELETE` for
 * permanent removal). Everything goes through the existing `api` client — no
 * second client architecture, and no direct database access from React.
 */

import type {
  CompanyDto,
  InsuranceOptionDto,
  InsuranceTypeDto,
  OptionFieldDto,
  Paginated,
  PlanConfigurationDto,
  PlanDto,
  PlanOptionDto,
  PlanOptionValueInput,
} from '@aggregator/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, query } from '@/lib/api-client';

/** Query key roots, so invalidation is consistent across features. */
export const keys = {
  companies: ['companies'] as const,
  insuranceTypes: ['insurance-types'] as const,
  insuranceOptions: ['insurance-options'] as const,
  plans: ['plans'] as const,
  planConfigurations: ['plan-configurations'] as const,
};

/** Lists are paginated; management screens want a generous page. */
const LIST_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export function useCompanies(filters: { isActive?: boolean; search?: string } = {}) {
  return useQuery({
    queryKey: [...keys.companies, filters],
    queryFn: () =>
      api.get<Paginated<CompanyDto>>(
        `/companies${query({ pageSize: LIST_PAGE_SIZE, ...filters })}`,
      ),
    select: (page) => page.items,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: [...keys.companies, id],
    queryFn: () => api.get<CompanyDto>(`/companies/${id}`),
    enabled: Boolean(id),
  });
}

export function useSaveCompany(id?: string) {
  return useInvalidatingMutation(keys.companies, (input: Record<string, unknown>) =>
    id ? api.patch<CompanyDto>(`/companies/${id}`, input) : api.post<CompanyDto>('/companies', input),
  );
}

export function useDeleteCompany() {
  return useInvalidatingMutation(keys.companies, (id: string) =>
    api.delete<void>(`/companies/${id}`),
  );
}

// ---------------------------------------------------------------------------
// Insurance types
// ---------------------------------------------------------------------------

export function useInsuranceTypes(filters: { isActive?: boolean } = {}) {
  return useQuery({
    queryKey: [...keys.insuranceTypes, filters],
    queryFn: () =>
      api.get<Paginated<InsuranceTypeDto>>(
        `/insurance-types${query({ pageSize: LIST_PAGE_SIZE, ...filters })}`,
      ),
    select: (page) => page.items,
  });
}

export function useSaveInsuranceType(id?: string) {
  return useInvalidatingMutation(keys.insuranceTypes, (input: Record<string, unknown>) =>
    id
      ? api.patch<InsuranceTypeDto>(`/insurance-types/${id}`, input)
      : api.post<InsuranceTypeDto>('/insurance-types', input),
  );
}

export function useDeleteInsuranceType() {
  return useInvalidatingMutation(keys.insuranceTypes, (id: string) =>
    api.delete<void>(`/insurance-types/${id}`),
  );
}

// ---------------------------------------------------------------------------
// Insurance options (the employee-defined benefit catalogue)
// ---------------------------------------------------------------------------

export function useInsuranceOptions(filters: { insuranceTypeId?: string; isActive?: boolean } = {}) {
  return useQuery({
    queryKey: [...keys.insuranceOptions, filters],
    queryFn: () =>
      api.get<Paginated<InsuranceOptionDto>>(
        `/insurance-options${query({ pageSize: LIST_PAGE_SIZE, ...filters })}`,
      ),
    select: (page) => page.items,
    /**
     * The configuration screen changes this query's key once the plan loads
     * (unfiltered -> filtered by insurance type). Without this the list would
     * empty while the new request is in flight, unmounting the draggable
     * benefits and cancelling any drag in progress.
     */
    placeholderData: keepPreviousData,
  });
}

export function useInsuranceOption(id: string | undefined) {
  return useQuery({
    queryKey: [...keys.insuranceOptions, id],
    queryFn: () => api.get<InsuranceOptionDto>(`/insurance-options/${id}`),
    enabled: Boolean(id),
  });
}

export function useSaveInsuranceOption(id?: string) {
  return useInvalidatingMutation(keys.insuranceOptions, (input: Record<string, unknown>) =>
    id
      ? api.patch<InsuranceOptionDto>(`/insurance-options/${id}`, input)
      : api.post<InsuranceOptionDto>('/insurance-options', input),
  );
}

export function useDeleteInsuranceOption() {
  return useInvalidatingMutation(keys.insuranceOptions, (id: string) =>
    api.delete<void>(`/insurance-options/${id}`),
  );
}

// --- Option fields (what information an option requires) --------------------

export function useCreateOptionField(optionId: string) {
  return useInvalidatingMutation(keys.insuranceOptions, (input: Record<string, unknown>) =>
    api.post<OptionFieldDto>(`/insurance-options/${optionId}/fields`, input),
  );
}

export function useUpdateOptionField() {
  return useInvalidatingMutation(
    keys.insuranceOptions,
    ({ fieldId, input }: { fieldId: string; input: Record<string, unknown> }) =>
      api.patch<OptionFieldDto>(`/option-fields/${fieldId}`, input),
  );
}

export function useDeleteOptionField() {
  return useInvalidatingMutation(keys.insuranceOptions, (fieldId: string) =>
    api.delete<void>(`/option-fields/${fieldId}`),
  );
}

export function useReorderOptionFields(optionId: string) {
  return useInvalidatingMutation(keys.insuranceOptions, (orderedIds: string[]) =>
    api.post<void>(`/insurance-options/${optionId}/fields/reorder`, { orderedIds }),
  );
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export function usePlans(filters: { companyId?: string; insuranceTypeId?: string; isActive?: boolean } = {}) {
  return useQuery({
    queryKey: [...keys.plans, filters],
    queryFn: () =>
      api.get<Paginated<PlanDto>>(`/plans${query({ pageSize: LIST_PAGE_SIZE, ...filters })}`),
    select: (page) => page.items,
  });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: [...keys.plans, id],
    queryFn: () => api.get<PlanDto>(`/plans/${id}`),
    enabled: Boolean(id),
  });
}

export function useSavePlan(id?: string) {
  return useInvalidatingMutation(keys.plans, (input: Record<string, unknown>) =>
    id ? api.patch<PlanDto>(`/plans/${id}`, input) : api.post<PlanDto>('/plans', input),
  );
}

export function useDeletePlan() {
  return useInvalidatingMutation(keys.plans, (id: string) => api.delete<void>(`/plans/${id}`));
}

// ---------------------------------------------------------------------------
// Plan configurations
// ---------------------------------------------------------------------------

/**
 * Configurations across the whole database, optionally filtered.
 * Also the query the comparison engine will use.
 */
export function usePlanConfigurations(
  filters: { planId?: string; companyId?: string; isActive?: boolean } = {},
) {
  return useQuery({
    queryKey: [...keys.planConfigurations, 'list', filters],
    queryFn: () =>
      api.get<Paginated<PlanConfigurationDto>>(
        `/plan-configurations${query({ pageSize: LIST_PAGE_SIZE, ...filters })}`,
      ),
    select: (page) => page.items,
  });
}

export function usePlanConfiguration(id: string | undefined) {
  return useQuery({
    queryKey: [...keys.planConfigurations, id],
    queryFn: () => api.get<PlanConfigurationDto>(`/plan-configurations/${id}`),
    enabled: Boolean(id),
  });
}

export function useSavePlanConfiguration(id?: string) {
  return useInvalidatingMutation(keys.planConfigurations, (input: Record<string, unknown>) =>
    id
      ? api.patch<PlanConfigurationDto>(`/plan-configurations/${id}`, input)
      : api.post<PlanConfigurationDto>('/plan-configurations', input),
  );
}

export function useDeletePlanConfiguration() {
  return useInvalidatingMutation(keys.planConfigurations, (id: string) =>
    api.delete<void>(`/plan-configurations/${id}`),
  );
}

// --- Options attached to a configuration ------------------------------------

export function useAddPlanOption(configurationId: string) {
  return useInvalidatingMutation(keys.planConfigurations, (optionId: string) =>
    api.post<PlanOptionDto>(`/plan-configurations/${configurationId}/options`, { optionId }),
  );
}

export function useRemovePlanOption() {
  return useInvalidatingMutation(keys.planConfigurations, (planOptionId: string) =>
    api.delete<void>(`/plan-options/${planOptionId}`),
  );
}

export function useReorderPlanOptions(configurationId: string) {
  return useInvalidatingMutation(keys.planConfigurations, (orderedIds: string[]) =>
    api.post<void>(`/plan-configurations/${configurationId}/options/reorder`, { orderedIds }),
  );
}

export function useSavePlanOptionValues() {
  return useInvalidatingMutation(
    keys.planConfigurations,
    ({ planOptionId, values }: { planOptionId: string; values: PlanOptionValueInput[] }) =>
      api.put<PlanOptionDto>(`/plan-options/${planOptionId}/values`, { values }),
  );
}

// ---------------------------------------------------------------------------

/**
 * A mutation that refreshes the affected resource on success. Plans and
 * configurations are refreshed together, since a configuration change alters
 * what a plan detail screen shows.
 */
function useInvalidatingMutation<TInput, TResult>(
  key: readonly string[],
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, unknown, TInput>({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      // A configuration change alters what a plan detail screen shows.
      if (key === keys.planConfigurations) {
        void queryClient.invalidateQueries({ queryKey: keys.plans });
      }
    },
  });
}
