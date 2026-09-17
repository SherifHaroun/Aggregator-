/**
 * Every application path in one place. Never hardcode a URL in a component.
 *
 * TWO SITES, ONE HOUSE. The CUSTOMER site opens at `/`: compare, leave your
 * details, read the results, open a plan, choose it. Nobody signs in there.
 * Everything an employee does lives under `/admin` behind the broker's own
 * sign-in at `/admin/login`. Both read and write the same API and the same
 * database, so a plan an employee publishes is on the customer site the
 * moment it is saved, and a visitor who leaves their details is on the
 * employee's Customers page — and their bell — the moment they do.
 *
 * The two can be DEPLOYED APART, on different URLs, from this one build:
 * see `config/site.ts`. The paths below do not change either way.
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

const ADMIN = '/admin';

export const ROUTES = {
  /** The customer site. */
  home: '/',
  public: {
    /**
     * ONE FINAL STEP before the results: who the visitor is and how to reach
     * them. The comparison travels in the query string, exactly as it does
     * to the results.
     */
    details: '/compare/details',
    /** The top three in each tier for what the visitor asked. */
    results: '/compare',
    /** One plan in full, for a visitor who has left their details. */
    plan: (configurationId: string) => `/plans/${configurationId}`,
    /** The visitor chose: the PDF is on its way, and so is a call. */
    chosen: '/compare/chosen',
    /** The broker's own pages: who they are and how to reach them. */
    about: '/about',
    services: '/services',
    regional: '/regional-capabilities',
    affiliated: '/affiliated-companies',
    contact: '/contact',
  },

  /** The employee area. */
  dashboard: ADMIN,
  /** The broker's own door. The only sign-in there is. */
  login: `${ADMIN}/login`,
  companies: {
    list: `${ADMIN}/companies`,
    new: `${ADMIN}/companies/new`,
    detail: (companyId: string) => `${ADMIN}/companies/${companyId}`,
  },
  plans: {
    /** Read-only list of every plan across all companies. */
    list: `${ADMIN}/plans`,
    detail: (companyId: string, planId: string) =>
      `${ADMIN}/companies/${companyId}/plans/${planId}`,
  },
  benefits: {
    /** The catalogue every company shares. Created here, valued on a variant. */
    list: `${ADMIN}/benefits`,
  },
  planTiers: {
    /** Read-only: what Basic, Standard and Premium mean. Nothing to manage. */
    list: `${ADMIN}/plan-tiers`,
  },
  medicalNetworks: {
    /** The shared list plans are sold on, each with its provider list on file. */
    list: `${ADMIN}/medical-networks`,
  },
  configurations: {
    detail: (companyId: string, planId: string, configurationId: string) =>
      `${ADMIN}/companies/${companyId}/plans/${planId}/configurations/${configurationId}`,
  },
  imports: {
    /**
     * One document being read into a company's section: the progress while
     * it is read, then the plans for review, then Publish. Its own page
     * because reading takes a minute or two and the review is a long form.
     */
    detail: (companyId: string, jobId: string) =>
      `${ADMIN}/companies/${companyId}/imports/${jobId}`,
  },
  customers: {
    /**
     * Who rang in or came through the website, and the comparisons kept for
     * each of them until they choose. A customer's page is their cart and
     * their visits.
     */
    list: `${ADMIN}/customers`,
    detail: (customerId: string) => `${ADMIN}/customers/${customerId}`,
  },
  offers: {
    /**
     * OFFERS REQUESTED: every customer with a plan in their cart — chosen by
     * the customer on the website or kept by an employee on a call — each
     * spread out in full: who they are, how to reach them, the notes, the
     * plans, and the one they linked. The dashboard's card leads here.
     */
    list: `${ADMIN}/offers`,
  },
  comparison: {
    new: `${ADMIN}/comparison/new`,
    results: `${ADMIN}/comparison/results`,
    /**
     * One compared plan, in full. The criteria travel with it in the query
     * string: the premium shown is the premium THIS customer would pay, so
     * the page has to be able to work it out again rather than be handed a
     * figure it cannot check.
     */
    plan: (configurationId: string) => `${ADMIN}/comparison/plan/${configurationId}`,
  },
} as const;

/** Route patterns, for registering routes in the router. */
export const ROUTE_PATTERNS = {
  publicPlan: '/plans/:configurationId',
  companyDetail: `${ADMIN}/companies/:companyId`,
  planDetail: `${ADMIN}/companies/:companyId/plans/:planId`,
  configurationDetail: `${ADMIN}/companies/:companyId/plans/:planId/configurations/:configurationId`,
  planImport: `${ADMIN}/companies/:companyId/imports/:jobId`,
  customerDetail: `${ADMIN}/customers/:customerId`,
  comparisonPlan: `${ADMIN}/comparison/plan/:configurationId`,
} as const;
