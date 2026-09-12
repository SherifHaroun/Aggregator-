import {
  CUSTOMER_TYPE_IDS,
  ENABLED_GEOGRAPHICAL_COVERAGE_IDS,
  PLAN_TIER_IDS,
  resolveSmeAgeBracketId,
  type ComparisonRequestInput,
  type CustomerTypeId,
  type GeographicalCoverageId,
  type PlanTierId,
} from '@aggregator/shared';

/**
 * THE COMPARISON, AS A LINK.
 *
 * The selection travels in the URL so a comparison can be sent to somebody and
 * survives a refresh. The results page and the plan page both read it back,
 * and they have to read it the same way — so this is the only place that
 * turns a query string into a request, and the only place that turns a
 * request into one.
 *
 * ONLY WHO IS BEING INSURED IS REQUIRED. Everything else is written only when
 * it was answered, and read back as absent when it was not: the API fills the
 * blanks with its standard assumptions and says so in the result. A link that
 * says nothing but `customerTypeId=FAMILY` is a complete comparison.
 */
export function parseComparisonRequest(params: URLSearchParams): ComparisonRequestInput | null {
  /**
   * Every value is checked against what the business actually offers rather
   * than cast and hoped for. A link carrying a customer type this system has
   * never heard of is not a selection, and saying so here is better than
   * sending it to the API to be refused.
   */
  const oneOf = <T extends string>(ids: readonly T[], value: string | null): T | null =>
    value !== null && (ids as readonly string[]).includes(value) ? (value as T) : null;

  const customerTypeId = oneOf<CustomerTypeId>(CUSTOMER_TYPE_IDS, params.get('customerTypeId'));
  if (!customerTypeId) return null;

  const geographicalCoverageId = oneOf<GeographicalCoverageId>(
    ENABLED_GEOGRAPHICAL_COVERAGE_IDS,
    params.get('geographicalCoverageId'),
  );
  const planTierId = oneOf<PlanTierId>(PLAN_TIER_IDS, params.get('planTierId'));
  const currency = params.get('currency')?.trim() || null;

  /**
   * An age that is not a whole number is not an age, and is read as none
   * given — the result will say the standard age was assumed, which is
   * visible, where refusing the whole link would not be.
   */
  const age = (name: string): number | null => {
    const raw = params.get(name);
    if (raw === null || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isInteger(value) ? value : null;
  };
  const ageFrom = age('ageFrom');
  const ageTo = age('ageTo');

  /**
   * No budget in the URL means no price ceiling — not an incomplete request.
   * A budget that is not a number is a different matter: dropping it would
   * quietly show plans the customer said they could not afford.
   */
  const rawBudget = params.get('budget');
  const budget = rawBudget === null ? undefined : Number(rawBudget);
  if (budget !== undefined && !Number.isFinite(budget)) return null;

  /**
   * The workforce, one parameter per occupied bracket — `employees=30–34:6`.
   * A bracket this system does not have is dropped rather than sent on: a
   * link written by hand should not be able to price against an age group
   * that does not exist.
   */
  const smeEmployees: Record<string, number> = {};
  for (const entry of params.getAll('employees')) {
    const separator = entry.lastIndexOf(':');
    if (separator === -1) continue;
    const bracketId = resolveSmeAgeBracketId(entry.slice(0, separator));
    const count = Number(entry.slice(separator + 1));
    if (bracketId === null) continue;
    if (!Number.isInteger(count) || count < 0) continue;
    smeEmployees[bracketId] = count;
  }

  return {
    ...(planTierId === null ? {} : { planTierId }),
    ...(Object.keys(smeEmployees).length > 0 ? { smeEmployees } : {}),
    customerTypeId,
    ...(geographicalCoverageId === null ? {} : { geographicalCoverageId }),
    ...(currency === null ? {} : { currency }),
    ...(ageFrom === null ? {} : { ageFrom }),
    ...(ageTo === null ? {} : { ageTo }),
    ...(budget === undefined ? {} : { budget }),
  };
}

/**
 * The request as a query string — the inverse of `parseComparisonRequest`.
 *
 * Only what was answered is written. Empty brackets are left out: nobody
 * being 55–59 is the default, and writing eleven zeroes down says no more
 * than omitting them.
 */
export function comparisonRequestParams(request: ComparisonRequestInput): URLSearchParams {
  const params = new URLSearchParams();
  if (request.planTierId) params.set('planTierId', request.planTierId);
  params.set('customerTypeId', request.customerTypeId);
  if (request.geographicalCoverageId) {
    params.set('geographicalCoverageId', request.geographicalCoverageId);
  }
  if (request.currency) params.set('currency', request.currency);
  if (request.ageFrom != null) params.set('ageFrom', String(request.ageFrom));
  if (request.ageTo != null) params.set('ageTo', String(request.ageTo));
  if (request.budget !== undefined) params.set('budget', String(request.budget));
  for (const [bracketId, count] of Object.entries(request.smeEmployees ?? {})) {
    if (count > 0) params.append('employees', `${bracketId}:${count}`);
  }
  return params;
}

/**
 * WHO THE COMPARISON IS FOR.
 *
 * The employee chooses the customer before comparing, and the customer
 * travels in the same query string as the selection — so the results and the
 * plan page know whose cart "Add to cart" goes into, and a link opened again
 * from that cart still belongs to that customer. It is not part of the
 * request the engine runs: `parseComparisonRequest` never reads it.
 */
export const COMPARISON_CUSTOMER_PARAM = 'customerId';

export function comparisonCustomerId(params: URLSearchParams): string | null {
  return params.get(COMPARISON_CUSTOMER_PARAM)?.trim() || null;
}

/** The results URL for a request, run for a customer. */
export function comparisonResultsUrl(
  resultsPath: string,
  request: ComparisonRequestInput,
  customerId: string | null,
): string {
  const params = comparisonRequestParams(request);
  if (customerId) params.set(COMPARISON_CUSTOMER_PARAM, customerId);
  return `${resultsPath}?${params.toString()}`;
}
