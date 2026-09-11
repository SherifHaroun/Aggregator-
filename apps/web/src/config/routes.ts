/**
 * Every application path in one place. Never hardcode a URL in a component.
 *
 * The management experience is a single drill-down:
 *   Companies -> Company -> Plan -> Variant
 *
 * A company is chosen, then one of its three customer-type sections, then a
 * plan in that section, then one of that plan's variants.
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
  },
  plans: {
    /** Read-only list of every plan across all companies. */
    list: '/plans',
    detail: (companyId: string, planId: string) => `/companies/${companyId}/plans/${planId}`,
  },
  benefits: {
    /** The catalogue every company shares. Created here, valued on a variant. */
    list: '/benefits',
  },
  planTiers: {
    /** Read-only: what Basic, Standard and Premium mean. Nothing to manage. */
    list: '/plan-tiers',
  },
  medicalNetworks: {
    /** The shared list plans are sold on, each with its provider list on file. */
    list: '/medical-networks',
  },
  configurations: {
    detail: (companyId: string, planId: string, configurationId: string) =>
      `/companies/${companyId}/plans/${planId}/configurations/${configurationId}`,
  },
  imports: {
    /**
     * One document being read into a company's section: the progress while
     * it is read, then the plans for review, then Publish. Its own page
     * because reading takes a minute or two and the review is a long form.
     */
    detail: (companyId: string, jobId: string) => `/companies/${companyId}/imports/${jobId}`,
  },
  comparison: {
    new: '/comparison/new',
    results: '/comparison/results',
    /**
     * One compared plan, in full. The criteria travel with it in the query
     * string: the premium shown is the premium THIS customer would pay, so
     * the page has to be able to work it out again rather than be handed a
     * figure it cannot check.
     */
    plan: (configurationId: string) => `/comparison/plan/${configurationId}`,
  },
} as const;

/** Route patterns, for registering routes in the router. */
export const ROUTE_PATTERNS = {
  companyDetail: '/companies/:companyId',
  planDetail: '/companies/:companyId/plans/:planId',
  configurationDetail: '/companies/:companyId/plans/:planId/configurations/:configurationId',
  planImport: '/companies/:companyId/imports/:jobId',
  comparisonPlan: '/comparison/plan/:configurationId',
} as const;
