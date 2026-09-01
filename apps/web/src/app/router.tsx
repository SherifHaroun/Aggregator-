import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ROUTES, ROUTE_PATTERNS } from '@/config/routes';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ComparisonResultsPage } from '@/pages/comparison/ComparisonResultsPage';
import { NewComparisonPage } from '@/pages/comparison/NewComparisonPage';
import { AddCompanyPage } from '@/pages/manage/AddCompanyPage';
import { CompaniesPage } from '@/pages/manage/CompaniesPage';
import { CompanyDetailPage } from '@/pages/manage/CompanyDetailPage';
import { PlanTiersPage } from '@/pages/manage/PlanTiersPage';
import { PlanConfigurationDetailPage } from '@/pages/manage/PlanConfigurationDetailPage';
import { PlanDetailPage } from '@/pages/manage/PlanDetailPage';
import { PlansPage } from '@/pages/manage/PlansPage';

/**
 * Route map. Paths come from `config/routes.ts`, never inline strings.
 *
 * Management is one drill-down — company, plan, configuration — so there are no
 * top-level routes for options or option fields. Plans and insurance types have
 * a read-only list each, reached from the dashboard tiles that count them.
 * Exported so tests can mount the real routes in a memory router.
 */
export const routes: RouteObject[] = [
  {
    path: ROUTES.dashboard,
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },

      { path: ROUTES.companies.list, element: <CompaniesPage /> },
      { path: ROUTES.companies.new, element: <AddCompanyPage /> },
      { path: ROUTE_PATTERNS.companyDetail, element: <CompanyDetailPage /> },
      { path: ROUTES.plans.list, element: <PlansPage /> },
      { path: ROUTE_PATTERNS.planDetail, element: <PlanDetailPage /> },
      { path: ROUTES.planTiers.list, element: <PlanTiersPage /> },
      { path: ROUTE_PATTERNS.configurationDetail, element: <PlanConfigurationDetailPage /> },

      { path: ROUTES.comparison.new, element: <NewComparisonPage /> },
      { path: ROUTES.comparison.results, element: <ComparisonResultsPage /> },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
