/**
 * Sidebar navigation. Adding a screen means adding an entry here — the layout
 * renders whatever this file describes.
 */

import { ROUTES } from './routes';

export interface NavItem {
  label: string;
  to: string;
  /** `false` renders the item as a disabled placeholder for a future screen. */
  available: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: ROUTES.dashboard, available: true }],
  },
  {
    title: 'Insurance data',
    items: [
      { label: 'Companies', to: ROUTES.companies.list, available: true },
      { label: 'Insurance types', to: ROUTES.insuranceTypes.list, available: true },
      { label: 'Plans', to: ROUTES.plans.list, available: true },
      { label: 'Insurance options', to: ROUTES.insuranceOptions.list, available: true },
    ],
  },
  {
    title: 'Comparison',
    items: [{ label: 'New comparison', to: ROUTES.comparison.new, available: true }],
  },
  {
    title: 'More',
    items: [
      { label: 'Reports', to: '/reports', available: false },
      { label: 'Settings', to: '/settings', available: false },
    ],
  },
];

/** Product name shown in the header. */
export const APP_NAME = 'Insurance Aggregator';
export const APP_SUBTITLE = 'Internal tool';
