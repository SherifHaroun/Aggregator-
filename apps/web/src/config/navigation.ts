/**
 * Sidebar navigation.
 *
 * Deliberately short. Plans, variants and their values are all reached by
 * drilling into a company, so the employee never has to hunt across parallel
 * screens.
 *
 * BENEFITS is the exception, and earns it: the catalogue belongs to no company.
 * It is one list shared by all of them, and a benefit has to exist in it before
 * any plan can point at one — so it cannot live underneath a company.
 *
 * "Compare plans" leads instead: it is what the site exists to do, and it reads
 * the same database the rest of these screens fill in.
 */

import type { ComponentType, SVGProps } from 'react';
import {
  IconAdd,
  IconBuilding,
  IconDashboard,
  IconLayers,
  IconSparkle,
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
  { label: 'Add Company', to: ROUTES.companies.new, icon: IconAdd },
  {
    label: 'Companies',
    to: ROUTES.companies.list,
    icon: IconBuilding,
    matchPrefix: ROUTES.companies.list,
  },
  { label: 'Benefits', to: ROUTES.benefits.list, icon: IconLayers },
];

export const APP_NAME = 'Hadbrok';
export const APP_TAGLINE = 'Insurance Aggregator';
