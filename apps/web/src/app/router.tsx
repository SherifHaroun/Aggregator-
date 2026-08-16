import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ROUTES, ROUTE_PATTERNS } from '@/config/routes';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ComparisonResultsPage } from '@/pages/comparison/ComparisonResultsPage';
import { NewComparisonPage } from '@/pages/comparison/NewComparisonPage';
import { CompaniesPage } from '@/pages/manage/CompaniesPage';
import { CompanyFormPage } from '@/pages/manage/CompanyFormPage';
import { InsuranceOptionDetailPage } from '@/pages/manage/InsuranceOptionDetailPage';
import { InsuranceOptionFormPage } from '@/pages/manage/InsuranceOptionFormPage';
import { InsuranceOptionsPage } from '@/pages/manage/InsuranceOptionsPage';
import { InsuranceTypesPage } from '@/pages/manage/InsuranceTypesPage';
import { PlanConfigurationDetailPage } from '@/pages/manage/PlanConfigurationDetailPage';
import { PlanConfigurationFormPage } from '@/pages/manage/PlanConfigurationFormPage';
import { PlanDetailPage } from '@/pages/manage/PlanDetailPage';
import { PlanFormPage } from '@/pages/manage/PlanFormPage';
import { PlansPage } from '@/pages/manage/PlansPage';

import type { RouteObject } from 'react-router-dom';

/**
 * Route map. Paths come from `config/routes.ts`, never inline strings.
 * Exported so tests can mount the real routes in a memory router.
 */
export const routes: RouteObject[] = [
  {
    path: ROUTES.dashboard,
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },

      { path: ROUTES.comparison.new, element: <NewComparisonPage /> },
      { path: ROUTES.comparison.results, element: <ComparisonResultsPage /> },

      { path: ROUTES.companies.list, element: <CompaniesPage /> },
      { path: ROUTES.companies.new, element: <CompanyFormPage /> },
      { path: ROUTE_PATTERNS.companyEdit, element: <CompanyFormPage /> },

      { path: ROUTES.insuranceTypes.list, element: <InsuranceTypesPage /> },

      { path: ROUTES.plans.list, element: <PlansPage /> },
      { path: ROUTES.plans.new, element: <PlanFormPage /> },
      { path: ROUTE_PATTERNS.planEdit, element: <PlanFormPage /> },
      { path: ROUTE_PATTERNS.planDetail, element: <PlanDetailPage /> },
      { path: ROUTE_PATTERNS.planConfigurationNew, element: <PlanConfigurationFormPage /> },
      { path: ROUTE_PATTERNS.planConfigurationDetail, element: <PlanConfigurationDetailPage /> },

      { path: ROUTES.insuranceOptions.list, element: <InsuranceOptionsPage /> },
      { path: ROUTES.insuranceOptions.new, element: <InsuranceOptionFormPage /> },
      { path: ROUTE_PATTERNS.insuranceOptionDetail, element: <InsuranceOptionDetailPage /> },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
