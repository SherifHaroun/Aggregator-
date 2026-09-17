import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PublicShell } from '@/components/layout/PublicShell';
import { ROUTES, ROUTE_PATTERNS } from '@/config/routes';
import { SERVES_ADMIN_SITE, SERVES_CUSTOMER_SITE } from '@/config/site';
import { RequireAdmin } from '@/features/auth/guards';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
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
import { OffersRequestedPage } from '@/pages/manage/OffersRequestedPage';
import { PlanConfigurationDetailPage } from '@/pages/manage/PlanConfigurationDetailPage';
import { PlanDetailPage } from '@/pages/manage/PlanDetailPage';
import { PlanImportPage } from '@/pages/manage/PlanImportPage';
import { PlansPage } from '@/pages/manage/PlansPage';
import { AboutPage, AffiliatedPage, ContactPage, RegionalPage } from '@/pages/public/CompanyPages';
import { ChosenPage } from '@/pages/public/ChosenPage';
import { HomePage } from '@/pages/public/HomePage';
import { LeadDetailsPage } from '@/pages/public/LeadDetailsPage';
import { ServicesPage } from '@/pages/public/ServicesPage';
import { PublicPlanPage } from '@/pages/public/PublicPlanPage';
import { PublicResultsPage } from '@/pages/public/PublicResultsPage';

/**
 * Route map. Paths come from `config/routes.ts`, never inline strings.
 *
 * TWO TREES. The customer site is the root: home, the "one final step"
 * details, the results, a plan in full, and the page that says the PDF is
 * on its way. Nobody signs in there. The employee area sits under `/admin`
 * behind the broker's sign-in at `/admin/login`; inside it, management is
 * one drill-down — company, plan, configuration — so there are no
 * top-level routes for options or option fields.
 *
 * `config/site.ts` decides which tree this build serves: both, or one of
 * them on a URL of its own. A tree not served here answers 404 (or, for a
 * build that is only the admin, the root leads straight to it).
 *
 * Exported so tests can mount the real routes in a memory router.
 */
const customerSite: RouteObject = {
  path: ROUTES.home,
  element: <PublicShell />,
  children: [
    { index: true, element: <HomePage /> },
    { path: ROUTES.public.details, element: <LeadDetailsPage /> },
    { path: ROUTES.public.results, element: <PublicResultsPage /> },
    { path: ROUTE_PATTERNS.publicPlan, element: <PublicPlanPage /> },
    { path: ROUTES.public.chosen, element: <ChosenPage /> },
    /* The broker's own pages: who they are and how to reach them. */
    { path: ROUTES.public.about, element: <AboutPage /> },
    { path: ROUTES.public.services, element: <ServicesPage /> },
    { path: ROUTES.public.regional, element: <RegionalPage /> },
    { path: ROUTES.public.affiliated, element: <AffiliatedPage /> },
    { path: ROUTES.public.contact, element: <ContactPage /> },
    { path: '*', element: <NotFoundPage /> },
  ],
};

const employeeArea: RouteObject[] = [
  /* The door stands outside the gate, in its own frame. */
  { path: ROUTES.login, element: <AdminLoginPage /> },
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

          /* Who rang in or came through the site, and what is kept for each. */
          { path: ROUTES.customers.list, element: <CustomersPage /> },
          { path: ROUTE_PATTERNS.customerDetail, element: <CustomerDetailPage /> },
          /* Everyone with a plan in their cart, spread out in full. */
          { path: ROUTES.offers.list, element: <OffersRequestedPage /> },

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

/** A build that is only the employee area: the root is the admin. */
const adminOnlyRoot: RouteObject[] = [
  { path: ROUTES.home, element: <Navigate to={ROUTES.dashboard} replace /> },
  { path: '*', element: <Navigate to={ROUTES.dashboard} replace /> },
];

export function buildRoutes({
  customer = SERVES_CUSTOMER_SITE,
  admin = SERVES_ADMIN_SITE,
}: { customer?: boolean; admin?: boolean } = {}): RouteObject[] {
  return [
    ...(admin ? employeeArea : []),
    ...(customer ? [customerSite] : admin ? adminOnlyRoot : [customerSite]),
  ];
}

export const routes: RouteObject[] = buildRoutes();

export const router = createBrowserRouter(routes);
