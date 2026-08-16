/**
 * Every application path in one place. Never hardcode a URL in a component.
 *
 * The management experience is a single drill-down:
 *   Companies -> Company -> Plan -> Configuration
 * Insurance types, options and option fields are managed inside that flow
 * rather than from their own top-level screens.
 */

export const ROUTES = {
  dashboard: '/',
  companies: {
    list: '/companies',
    new: '/companies/new',
    detail: (companyId: string) => `/companies/${companyId}`,
  },
  plans: {
    detail: (companyId: string, planId: string) => `/companies/${companyId}/plans/${planId}`,
  },
  configurations: {
    detail: (companyId: string, planId: string, configurationId: string) =>
      `/companies/${companyId}/plans/${planId}/configurations/${configurationId}`,
  },
  comparison: {
    new: '/comparison/new',
    results: '/comparison/results',
  },
} as const;

/** Route patterns, for registering routes in the router. */
export const ROUTE_PATTERNS = {
  companyDetail: '/companies/:companyId',
  planDetail: '/companies/:companyId/plans/:planId',
  configurationDetail: '/companies/:companyId/plans/:planId/configurations/:configurationId',
} as const;

/**
 * Query flag set right after a company is created, so the company screen opens
 * in "set up your plans" mode instead of the normal management view.
 */
export const SETUP_FLAG = 'setup';
