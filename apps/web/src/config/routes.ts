/** Every application path in one place. Never hardcode a URL in a component. */

export const ROUTES = {
  dashboard: '/',
  comparison: {
    new: '/comparison/new',
    results: '/comparison/results',
  },
  companies: {
    list: '/manage/companies',
    new: '/manage/companies/new',
    edit: (id: string) => `/manage/companies/${id}/edit`,
  },
  insuranceTypes: {
    list: '/manage/insurance-types',
  },
  plans: {
    list: '/manage/plans',
    new: '/manage/plans/new',
    detail: (id: string) => `/manage/plans/${id}`,
    edit: (id: string) => `/manage/plans/${id}/edit`,
  },
  planConfigurations: {
    new: (planId: string) => `/manage/plans/${planId}/configurations/new`,
    detail: (id: string) => `/manage/configurations/${id}`,
  },
  insuranceOptions: {
    list: '/manage/insurance-options',
    new: '/manage/insurance-options/new',
    detail: (id: string) => `/manage/insurance-options/${id}`,
  },
} as const;

/** Route patterns, for registering routes in the router. */
export const ROUTE_PATTERNS = {
  companyEdit: '/manage/companies/:companyId/edit',
  planDetail: '/manage/plans/:planId',
  planEdit: '/manage/plans/:planId/edit',
  planConfigurationNew: '/manage/plans/:planId/configurations/new',
  planConfigurationDetail: '/manage/configurations/:configurationId',
  insuranceOptionDetail: '/manage/insurance-options/:optionId',
} as const;
