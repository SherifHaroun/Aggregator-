import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PublicShell } from '@/components/layout/PublicShell';
import { ROUTES, ROUTE_PATTERNS } from '@/config/routes';
import { RequireAdmin, RequireCustomer } from '@/features/auth/guards';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ComparisonResultsPage } from '@/pages/comparison/ComparisonResultsPage';
import { PlanDetailsPage } from '@/pages/comparison/PlanDetailsPage';
import { NewComparisonPage } from '@/pages/comparison/NewComparisonPage';
import { AddCompanyPage } from '@/pages/manage/AddCompanyPage';
import { CompaniesPage } from '@/pages/manage/CompaniesPage';
import { CompanyDetailPage } from '@/pages/manage/CompanyDetailPage';
import { CustomerDetailPage } from '@/pages/manage/CustomerDetailPage';
import { CustomersPage } from '@/pages/manage/CustomersPage';
import { BenefitsPage } from '@/pages/manage/BenefitsPage';
import { PlanTiersPage } from '@/pages/manage/PlanTiersPage';
import { MedicalNetworksPage } from '@/pages/manage/MedicalNetworksPage';
import { PlanConfigurationDetailPage } from '@/pages/manage/PlanConfigurationDetailPage';
import { PlanDetailPage } from '@/pages/manage/PlanDetailPage';
import { PlanImportPage } from '@/pages/manage/PlanImportPage';
import { PlansPage } from '@/pages/manage/PlansPage';
import {
  AboutPage,
  AffiliatedPage,
  ContactPage,
  RegionalPage,
  ServicesPage,
} from '@/pages/public/CompanyPages';
import { HomePage } from '@/pages/public/HomePage';
import { LoginPage } from '@/pages/public/LoginPage';
import { MyCartPage } from '@/pages/public/MyCartPage';
import { PublicPlanPage } from '@/pages/public/PublicPlanPage';
import { PublicResultsPage } from '@/pages/public/PublicResultsPage';

/**
 * Route map. Paths come from `config/routes.ts`, never inline strings.
 *
 * TWO TREES. The customer site is the root: home, results, sign-in, and —
 * behind a customer sign-in — a plan in full and the cart. The employee
 * area sits under `/admin` behind a staff sign-in; inside it, management is
 * one drill-down — company, plan, configuration — so there are no top-level
 * routes for options or option fields.
 *
 * Exported so tests can mount the real routes in a memory router.
 */
export const routes: RouteObject[] = [
  {
    path: ROUTES.home,
    element: <PublicShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: ROUTES.public.results, element: <PublicResultsPage /> },
      { path: ROUTES.public.login, element: <LoginPage /> },
      /* The broker's own pages: who they are and how to reach them. */
      { path: ROUTES.public.about, element: <AboutPage /> },
      { path: ROUTES.public.services, element: <ServicesPage /> },
      { path: ROUTES.public.regional, element: <RegionalPage /> },
      { path: ROUTES.public.affiliated, element: <AffiliatedPage /> },
      { path: ROUTES.public.contact, element: <ContactPage /> },
      {
        element: <RequireCustomer />,
        children: [
          { path: ROUTE_PATTERNS.publicPlan, element: <PublicPlanPage /> },
          { path: ROUTES.public.cart, element: <MyCartPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: ROUTES.dashboard,
    element: <RequireAdmin />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },

          { path: ROUTES.companies.list, element: <CompaniesPage /> },
          { path: ROUTES.companies.new, element: <AddCompanyPage /> },
          { path: ROUTE_PATTERNS.companyDetail, element: <CompanyDetailPage /> },
          { path: ROUTES.plans.list, element: <PlansPage /> },
          { path: ROUTE_PATTERNS.planDetail, element: <PlanDetailPage /> },
          { path: ROUTES.benefits.list, element: <BenefitsPage /> },
          { path: ROUTES.planTiers.list, element: <PlanTiersPage /> },
          { path: ROUTES.medicalNetworks.list, element: <MedicalNetworksPage /> },
          { path: ROUTE_PATTERNS.configurationDetail, element: <PlanConfigurationDetailPage /> },
          /* A document being read into a company's section, then reviewed. */
          { path: ROUTE_PATTERNS.planImport, element: <PlanImportPage /> },

          /* Who rang in, and the comparisons kept for each of them. */
          { path: ROUTES.customers.list, element: <CustomersPage /> },
          { path: ROUTE_PATTERNS.customerDetail, element: <CustomerDetailPage /> },

          { path: ROUTES.comparison.new, element: <NewComparisonPage /> },
          { path: ROUTES.comparison.results, element: <ComparisonResultsPage /> },
          /* One compared plan in full, reached from the results and shareable. */
          { path: ROUTE_PATTERNS.comparisonPlan, element: <PlanDetailsPage /> },

          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
