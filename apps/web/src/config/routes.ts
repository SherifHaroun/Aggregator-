/**
 * Every application path in one place. Never hardcode a URL in a component.
 *
 * TWO FRONT DOORS, ONE HOUSE. The site opens on the CUSTOMER pages at `/`:
 * compare, sign in, read a plan, keep it. Everything an employee does lives
 * under `/admin` and needs a staff sign-in. Both read and write the same
 * API and the same database, so a plan an employee publishes is on the
 * customer site the moment it is saved.
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
    /** The top three in each tier for what the customer asked. */
    results: '/compare',
    /** One plan in full, for a signed-in customer. */
    plan: (configurationId: string) => `/plans/${configurationId}`,
    /** What the signed-in customer has kept. */
    cart: '/my-cart',
    /** One door for customers and staff alike. */
    login: '/login',
    /** The broker's own pages: who they are and how to reach them. */
    about: '/about',
    services: '/services',
    regional: '/regional-capabilities',
    affiliated: '/affiliated-companies',
    contact: '/contact',
  },

  /** The employee area. */
  dashboard: ADMIN,
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
     * Who rang in, and the comparisons kept for each of them until they
     * choose. A customer's page is their cart.
     */
    list: `${ADMIN}/customers`,
    detail: (customerId: string) => `${ADMIN}/customers/${customerId}`,
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
