/**
 * Sidebar navigation.
 *
 * Deliberately three items. Insurance types, plans, options, configurations and
 * option fields are all reached by drilling into a company, so the sidebar stays
 * short and the employee never has to hunt across parallel screens.
 */

import type { ComponentType, SVGProps } from 'react';
import { IconAdd, IconBuilding, IconDashboard } from '@/components/ui/icons';
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
  { label: 'Add Company', to: ROUTES.companies.new, icon: IconAdd },
  {
    label: 'Companies',
    to: ROUTES.companies.list,
    icon: IconBuilding,
    matchPrefix: ROUTES.companies.list,
  },
];

export const APP_NAME = 'Hadbrok';
export const APP_TAGLINE = 'Insurance Aggregator';
