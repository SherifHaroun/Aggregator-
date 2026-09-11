import {
  PLAN_IMPORT_POLL_MS,
  type CustomerTypeId,
  type PlanImportJobDto,
} from '@aggregator/shared';
import { useQuery } from '@tanstack/react-query';
import { api, query, uploadFile } from '@/lib/api-client';

export const importKeys = {
  all: ['plan-imports'] as const,
  job: (jobId: string) => ['plan-imports', jobId] as const,
};

/** Hand the document to the API. It answers with the job, already running. */
export function startPlanImport(
  companyId: string,
  customerType: CustomerTypeId,
  file: File,
): Promise<PlanImportJobDto> {
  return uploadFile<PlanImportJobDto>(
    `/plan-imports${query({ companyId, customerType })}`,
    file,
    'POST',
  );
}

const settled = (job: PlanImportJobDto | undefined) =>
  job !== undefined && (job.status === 'DONE' || job.status === 'FAILED');

/**
 * Where the job is, asked again every little while until it is DONE or
 * FAILED. Once it has settled the answer is kept and never re-fetched, so the
 * review screen's edits are not disturbed by a refresh.
 */
export function usePlanImport(jobId: string | undefined) {
  return useQuery({
    queryKey: importKeys.job(jobId ?? ''),
    queryFn: () => api.get<PlanImportJobDto>(`/plan-imports/${jobId}`),
    enabled: jobId !== undefined && jobId !== '',
    refetchInterval: (state) => (settled(state.state.data) ? false : PLAN_IMPORT_POLL_MS),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
