/**
 * React Query hooks for every insurance-data resource.
 *
 * One file, because the resources share a single, uniform contract
 * (`Paginated<T>` lists, `PATCH` for edits including deactivation, `DELETE` for
 * permanent removal). Everything goes through the existing `api` client — no
 * second client architecture, and no direct database access from React.
 */

import type {
  BenefitValueKind,
  ComparisonPriceRangeDto,
  ComparisonRequestInput,
  ComparisonResultDto,
  CompanyDto,
  InsuranceOptionDto,
  InsuranceTypeDto,
  Paginated,
  PlanConfigurationDto,
  PlanDto,
  PlanOptionDto,
  PlanOptionValueInput,
} from '@aggregator/shared';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api, query } from '@/lib/api-client';

/** Query key roots, so invalidation is consistent across features. */
export const keys = {
  companies: ['companies'] as const,
  insuranceTypes: ['insurance-types'] as const,
  insuranceOptions: ['insurance-options'] as const,
  plans: ['plans'] as const,
  planConfigurations: ['plan-configurations'] as const,
  comparison: ['comparison'] as const,
};

/** Lists are paginated; management screens want a generous page. */
const LIST_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Comparison (customer-facing)
// ---------------------------------------------------------------------------

/** Currencies plans are actually priced in. Read from the database. */
export function useComparisonCurrencies() {
  return useQuery({
    queryKey: [...keys.comparison, 'currencies'],
    queryFn: () => api.get<string[]>('/comparison/currencies'),
  });
}

/**
 * What the plans matching everything-but-the-budget cost.
 *
 * Keyed by the requirements, so moving a filter fetches once and coming back
 * is served from cache. `null` while the requirements are incomplete.
 */
export function useComparisonPriceRange(request: Omit<ComparisonRequestInput, 'budget'> | null) {
  return useQuery({
    queryKey: [...keys.comparison, 'price-range', request],
    queryFn: () =>
      api.post<ComparisonPriceRangeDto>(
        '/comparison/price-range',
        request as Omit<ComparisonRequestInput, 'budget'>,
      ),
    enabled: request !== null,
    placeholderData: keepPreviousData,
  });
}

/**
 * Run a comparison.
 *
 * Keyed by the whole request, so changing one filter fetches exactly one new
 * result and returning to a previous selection is served from cache — no
 * refetch, no full reload. The engine runs on the API; nothing is scored here.
 */
export function useComparison(request: ComparisonRequestInput | null) {
  return useQuery({
    queryKey: [...keys.comparison, 'run', request],
    queryFn: () => api.post<ComparisonResultDto>('/comparison', request as ComparisonRequestInput),
    enabled: request !== null,
    placeholderData: keepPreviousData,
  });
}

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
    id
      ? api.patch<CompanyDto>(`/companies/${id}`, input)
      : api.post<CompanyDto>('/companies', input),
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

/**
 * The global benefit catalogue — every benefit, offered to every plan.
 *
 * There is no company or insurance-type filter, because a benefit belongs to
 * neither: creating one makes it available everywhere at once.
 */
export function useInsuranceOptions(filters: { isActive?: boolean } = {}) {
  return useQuery({
    queryKey: [...keys.insuranceOptions, filters],
    queryFn: () =>
      api.get<Paginated<InsuranceOptionDto>>(
        `/insurance-options${query({ pageSize: LIST_PAGE_SIZE, ...filters })}`,
      ),
    select: (page) => page.items,
    /** Keeps the draggable list mounted across refetches, so a drag in
     *  progress is never cancelled underneath the employee. */
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

/**
 * Create a benefit.
 *
 * The payload is a name and what the benefit carries — a percentage, a limit or
 * text — which the API turns into the one field behind it. `isUmbrella` creates
 * a group that carries nothing, and `parentId` puts the benefit inside such a
 * group. The benefit is global either way.
 */
export function useCreateInsuranceOption() {
  return useInvalidatingMutation(
    keys.insuranceOptions,
    (input: {
      name: string;
      valueKind?: BenefitValueKind;
      alternativeKind?: BenefitValueKind;
      isUmbrella?: boolean;
      parentId?: string;
    }) => api.post<InsuranceOptionDto>('/insurance-options', input),
  );
}

/**
 * Edit a benefit itself — its name, or what it carries.
 *
 * A benefit is global, so a change lands on every plan of every company the
 * moment it saves; nothing holds a copy of either. Changing `valueKind` also
 * migrates the values already recorded against it, which is why plans and
 * configurations are refreshed alongside the catalogue and not just the name.
 */
export function useSaveInsuranceOption(id: string) {
  const queryClient = useQueryClient();

  return useMutation<InsuranceOptionDto, unknown, { name?: string; valueKind?: BenefitValueKind }>({
    mutationFn: (input) => api.patch<InsuranceOptionDto>(`/insurance-options/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.insuranceOptions });
      void queryClient.invalidateQueries({ queryKey: keys.planConfigurations });
      void queryClient.invalidateQueries({ queryKey: keys.plans });
    },
  });
}

/**
 * Delete a benefit from the catalogue for good.
 *
 * `force` carries the deletion through when configurations still carry the
 * benefit, or when a group still holds sub-benefits — the API refuses both
 * without it, so the employee is always told what depends on the benefit before
 * anything is destroyed.
 *
 * Plans and configurations are refreshed alongside the catalogue: a forced
 * delete detaches the benefit everywhere, so any screen showing a benefit count
 * or a coverage list is now out of date.
 */
export function useDeleteInsuranceOption() {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, { id: string; force?: boolean }>({
    mutationFn: ({ id, force }) =>
      api.delete<void>(`/insurance-options/${id}${force ? '?force=true' : ''}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.insuranceOptions });
      void queryClient.invalidateQueries({ queryKey: keys.planConfigurations });
      void queryClient.invalidateQueries({ queryKey: keys.plans });
    },
  });
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export function usePlans(
  filters: { companyId?: string; insuranceTypeId?: string; isActive?: boolean } = {},
) {
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

/**
 * The same configuration for a different age band — the write behind "Add
 * different age".
 *
 * Everything omitted is inherited from the source, benefits and their values
 * included, so the payload is usually the new band and the new price.
 */
export function useDuplicatePlanConfiguration(sourceId: string) {
  return useInvalidatingMutation(keys.planConfigurations, (input: Record<string, unknown>) =>
    api.post<PlanConfigurationDto>(`/plan-configurations/${sourceId}/duplicate`, input),
  );
}

// --- Options attached to a configuration ------------------------------------

/**
 * Attaching, detaching and reordering benefits are drag-and-drop gestures, so
 * they have to feel instant: each one writes the change into the cache first,
 * sends the request in the background, and puts the cache back if the request
 * fails.
 *
 * None of them invalidates a query. A refetch would replace every object the
 * coverage board is rendering, which both costs a round trip the employee can
 * see and defeats the memoized rows. The affected configuration is patched in
 * place instead — in the detail query, in any configuration list, and inside
 * any cached plan — so screens showing a benefit count stay correct without a
 * single extra request.
 */

/** Id an attached benefit carries until the server confirms it. */
const optimisticId = (optionId: string) => `optimistic:${optionId}`;

/** True while this row exists only in the cache. Such a row is not draggable. */
export const isOptimisticPlanOption = (planOption: PlanOptionDto) =>
  planOption.id.startsWith('optimistic:');

/**
 * The row to show the moment a benefit is dropped, built from the benefit's own
 * definition so it renders exactly like the confirmed row that replaces it.
 */
function optimisticPlanOption(
  configurationId: string,
  option: InsuranceOptionDto,
  sortOrder: number,
): PlanOptionDto {
  const now = new Date().toISOString();
  return {
    id: optimisticId(option.id),
    planConfigurationId: configurationId,
    optionId: option.id,
    optionName: option.name,
    isUmbrella: option.isUmbrella,
    parentOptionId: option.parentId,
    note: null,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    values: (option.fields ?? []).map((field) => ({
      id: '',
      optionFieldId: field.id,
      fieldKey: field.key,
      fieldLabel: field.label,
      dataType: field.dataType,
      unit: field.unit,
      value: null,
    })),
  };
}

/**
 * What one drop attaches: the benefit itself and, when it belongs to a group,
 * the rest of that group in reading order.
 *
 * A group and its parts travel together — a heading with nothing under it, or a
 * sub-benefit with no heading, is not something an employee ever means to
 * create. The API applies the same rule; this is the client's matching guess,
 * so the board looks settled before the response lands.
 */
export interface AttachBenefitInput {
  /** The benefit that was dropped or added. */
  option: InsuranceOptionDto;
  /** Every benefit this gesture attaches, in the order they should read. */
  rows: InsuranceOptionDto[];
}

/** `Array.map` that returns the ORIGINAL array when nothing changed, so
 *  untouched caches keep their identity and their subscribers never rerender. */
function mapChanged<T>(items: T[], map: (item: T) => T): T[] {
  let changed = false;
  const next = items.map((item) => {
    const mapped = map(item);
    if (mapped !== item) changed = true;
    return mapped;
  });
  return changed ? next : items;
}

/**
 * Apply `update` to one configuration's benefits everywhere it is cached.
 *
 * Every other cached record is left identical, which is what keeps "only
 * update the affected record" true of the client cache too.
 */
function updateConfigurationOptions(
  queryClient: QueryClient,
  configurationId: string,
  update: (options: PlanOptionDto[]) => PlanOptionDto[],
): void {
  const patchConfiguration = (configuration: PlanConfigurationDto): PlanConfigurationDto => {
    if (configuration.id !== configurationId) return configuration;
    const options = update(configuration.options ?? []);
    return options === configuration.options ? configuration : { ...configuration, options };
  };

  // The configuration detail query — what the coverage board renders.
  queryClient.setQueryData<PlanConfigurationDto>(
    [...keys.planConfigurations, configurationId],
    (configuration) => (configuration ? patchConfiguration(configuration) : configuration),
  );

  // Configuration lists.
  queryClient.setQueriesData<Paginated<PlanConfigurationDto>>(
    { queryKey: [...keys.planConfigurations, 'list'] },
    (page) => (page ? { ...page, items: mapChanged(page.items, patchConfiguration) } : page),
  );

  // Plans carry their configurations, and the plan screen shows a benefit count.
  const patchPlan = (plan: PlanDto): PlanDto => {
    if (!plan.configurations) return plan;
    const configurations = mapChanged(plan.configurations, patchConfiguration);
    return configurations === plan.configurations ? plan : { ...plan, configurations };
  };

  queryClient.setQueriesData<PlanDto | Paginated<PlanDto>>({ queryKey: keys.plans }, (data) => {
    if (!data) return data;
    if ('items' in data) {
      const items = mapChanged(data.items, patchPlan);
      return items === data.items ? data : { ...data, items };
    }
    return patchPlan(data);
  });
}

/**
 * Stop any in-flight refetch from landing on top of the optimistic write, and
 * keep the benefits as they were so a failure can be undone.
 */
async function beginOptimisticOptions(
  queryClient: QueryClient,
  configurationId: string,
): Promise<PlanOptionDto[] | undefined> {
  await queryClient.cancelQueries({ queryKey: [...keys.planConfigurations, configurationId] });
  return queryClient.getQueryData<PlanConfigurationDto>([
    ...keys.planConfigurations,
    configurationId,
  ])?.options;
}

/** Undo an optimistic write. Falls back to a refetch when there was nothing to
 *  snapshot, so a failure can never leave unsaved data on screen. */
function rollbackOptions(
  queryClient: QueryClient,
  configurationId: string,
  previous: PlanOptionDto[] | undefined,
): void {
  if (previous) {
    updateConfigurationOptions(queryClient, configurationId, () => previous);
    return;
  }
  void queryClient.invalidateQueries({ queryKey: [...keys.planConfigurations, configurationId] });
}

/**
 * Attach a benefit. Takes the whole benefit — and its group — so the rows can
 * be shown at once.
 *
 * The response is a LIST, because attaching a group creates a row per part of
 * it. Each returned row replaces the placeholder standing in for the same
 * benefit, so the board never flickers between the two.
 */
export function useAddPlanOption(configurationId: string) {
  const queryClient = useQueryClient();

  return useMutation<PlanOptionDto[], unknown, AttachBenefitInput, PlanOptionDto[] | undefined>({
    mutationFn: ({ option }) =>
      api.post<PlanOptionDto[]>(`/plan-configurations/${configurationId}/options`, {
        optionId: option.id,
      }),
    onMutate: async ({ rows }) => {
      const previous = await beginOptimisticOptions(queryClient, configurationId);
      updateConfigurationOptions(queryClient, configurationId, (options) => {
        const attached = new Set(options.map((item) => item.optionId));
        const added = rows
          .filter((row) => !attached.has(row.id))
          .map((row, index) => optimisticPlanOption(configurationId, row, options.length + index));
        return added.length === 0 ? options : [...options, ...added];
      });
      return previous;
    },
    onError: (_error, _input, previous) => rollbackOptions(queryClient, configurationId, previous),
    // Swap each placeholder for the server's row: same position, real ids.
    onSuccess: (saved) =>
      updateConfigurationOptions(queryClient, configurationId, (options) => {
        const byOptionId = new Map(saved.map((row) => [row.optionId, row]));
        return mapChanged(options, (item) => byOptionId.get(item.optionId) ?? item);
      }),
  });
}

export function useRemovePlanOption(configurationId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, string, PlanOptionDto[] | undefined>({
    mutationFn: (planOptionId) => api.delete<void>(`/plan-options/${planOptionId}`),
    onMutate: async (planOptionId) => {
      const previous = await beginOptimisticOptions(queryClient, configurationId);
      updateConfigurationOptions(queryClient, configurationId, (options) =>
        options.filter((item) => item.id !== planOptionId),
      );
      return previous;
    },
    onError: (_error, _planOptionId, previous) =>
      rollbackOptions(queryClient, configurationId, previous),
  });
}

export function useReorderPlanOptions(configurationId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, string[], PlanOptionDto[] | undefined>({
    mutationFn: (orderedIds) =>
      api.post<void>(`/plan-configurations/${configurationId}/options/reorder`, { orderedIds }),
    onMutate: async (orderedIds) => {
      const previous = await beginOptimisticOptions(queryClient, configurationId);
      // The cache holds the new order immediately, so the drop is the last
      // thing that has to happen before the list looks settled.
      updateConfigurationOptions(queryClient, configurationId, (options) =>
        orderedIds.flatMap((id, index) => {
          const item = options.find((option) => option.id === id);
          return item ? { ...item, sortOrder: index } : [];
        }),
      );
      return previous;
    },
    onError: (_error, _orderedIds, previous) =>
      rollbackOptions(queryClient, configurationId, previous),
  });
}

/**
 * Save ONE value of a benefit inside one configuration.
 *
 * What every inline box uses. A benefit may carry two figures — "800 EGP or
 * 80%" — each in its own self-saving box, so a box must write its own field and
 * nothing else; replacing the whole set would have each box wipe the other.
 */
export function useSavePlanOptionValue() {
  const queryClient = useQueryClient();

  return useMutation<
    PlanOptionDto,
    unknown,
    {
      planOptionId: string;
      planConfigurationId: string;
      optionFieldId: string;
      value: number | string | boolean | null;
    }
  >({
    mutationFn: ({ planOptionId, optionFieldId, value }) =>
      api.put<PlanOptionDto>(`/plan-options/${planOptionId}/values/${optionFieldId}`, { value }),
    onSuccess: (saved, { planConfigurationId }) =>
      updateConfigurationOptions(queryClient, planConfigurationId, (options) =>
        mapChanged(options, (item) => (item.id === saved.id ? saved : item)),
      ),
  });
}

/**
 * Save the remark carried by one benefit inside one configuration.
 *
 * Written separately from the values, because it is edited separately: the note
 * sits beside the figure and saves itself, and neither may overwrite the other.
 * The server's row is written straight into the cache, as with values.
 */
export function useSavePlanOptionNote() {
  const queryClient = useQueryClient();

  return useMutation<
    PlanOptionDto,
    unknown,
    { planOptionId: string; planConfigurationId: string; note: string | null }
  >({
    mutationFn: ({ planOptionId, note }) =>
      api.patch<PlanOptionDto>(`/plan-options/${planOptionId}/note`, { note }),
    onSuccess: (saved, { planConfigurationId }) =>
      updateConfigurationOptions(queryClient, planConfigurationId, (options) =>
        mapChanged(options, (item) => (item.id === saved.id ? saved : item)),
      ),
  });
}

/**
 * Save the values of one benefit inside one configuration.
 *
 * The server's response is written straight into the cache, so the record the
 * board renders matches the database without refetching anything.
 */
export function useSavePlanOptionValues() {
  const queryClient = useQueryClient();

  return useMutation<
    PlanOptionDto,
    unknown,
    { planOptionId: string; planConfigurationId: string; values: PlanOptionValueInput[] }
  >({
    mutationFn: ({ planOptionId, values }) =>
      api.put<PlanOptionDto>(`/plan-options/${planOptionId}/values`, { values }),
    onSuccess: (saved, { planConfigurationId }) =>
      updateConfigurationOptions(queryClient, planConfigurationId, (options) =>
        mapChanged(options, (item) => (item.id === saved.id ? saved : item)),
      ),
  });
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
