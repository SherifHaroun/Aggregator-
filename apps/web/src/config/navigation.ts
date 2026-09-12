/**
 * Sidebar navigation.
 *
 * Deliberately short. Plans, variants and their values are all reached by
 * drilling into a company, so the employee never has to hunt across parallel
 * screens.
 *
 * BENEFITS and MEDICAL NETWORKS are the exceptions, and earn it: each is one
 * list shared by every company — a benefit has to exist before a plan can
 * point at it, and GlobeMed is one network however many insurers sell on it —
 * so neither can live underneath a company.
 *
 * "Compare plans" leads instead: it is what the site exists to do, and it reads
 * the same database the rest of these screens fill in.
 *
 * CUSTOMERS sits beside it: the people those comparisons are run for, each
 * with the comparisons kept in their cart until they choose.
 */

import type { ComponentType, SVGProps } from 'react';
import {
  IconAdd,
  IconBuilding,
  IconDashboard,
  IconGlobe,
  IconLayers,
  IconSparkle,
  IconUsers,
} from '@/components/ui/icons';
import { ROUTES } from './routes';

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Highlight the item for any deeper URL under it, not just an exact match. */
  matchPrefix?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: ROUTES.dashboard, icon: IconDashboard },
  {
    label: 'Compare plans',
    to: ROUTES.comparison.new,
    icon: IconSparkle,
    matchPrefix: '/comparison',
  },
  {
    label: 'Customers',
    to: ROUTES.customers.list,
    icon: IconUsers,
    matchPrefix: ROUTES.customers.list,
  },
  { label: 'Add Company', to: ROUTES.companies.new, icon: IconAdd },
  {
    label: 'Companies',
    to: ROUTES.companies.list,
    icon: IconBuilding,
    matchPrefix: ROUTES.companies.list,
  },
  { label: 'Benefits', to: ROUTES.benefits.list, icon: IconLayers },
  { label: 'Medical networks', to: ROUTES.medicalNetworks.list, icon: IconGlobe },
];

export const APP_NAME = 'Hadbrok';
export const APP_TAGLINE = 'Insurance Aggregator';
