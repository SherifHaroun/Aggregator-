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
    /** Step 2 of the create flow: add this company's plans. */
    setup: (companyId: string) => `/companies/${companyId}/setup`,
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
  companySetup: '/companies/:companyId/setup',
  planDetail: '/companies/:companyId/plans/:planId',
  configurationDetail: '/companies/:companyId/plans/:planId/configurations/:configurationId',
} as const;
