/**
 * Every application path in one place. Never hardcode a URL in a component.
 *
 * The management experience is a single drill-down:
 *   Companies -> Company -> Plan -> Configuration
 * Options and option fields are managed inside that flow rather than from their
 * own top-level screens.
 *
 * Plans and insurance types additionally have a read-only top-level list, so
 * the dashboard tiles counting them have somewhere to lead. Editing either one
 * still happens in the drill-down.
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
    /** Read-only list of every plan across all companies. */
    list: '/plans',
    detail: (companyId: string, planId: string) => `/companies/${companyId}/plans/${planId}`,
  },
  insuranceTypes: {
    /** Read-only list of every insurance type. */
    list: '/insurance-types',
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
