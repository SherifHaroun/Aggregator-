import type { SVGProps } from 'react';

/**
 * Inline icon set.
 *
 * Kept in-repo rather than pulled from an icon package: the app needs a dozen
 * glyphs, and inlining them avoids a dependency and keeps the bundle small.
 * All icons share a 20x20 viewBox and inherit `currentColor`.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="2.5" width="6" height="6.5" rx="1.5" />
    <rect x="11.5" y="2.5" width="6" height="4" rx="1.5" />
    <rect x="11.5" y="9" width="6" height="8.5" rx="1.5" />
    <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" />
  </Icon>
);

export const IconAdd = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 6.8v6.4M6.8 10h6.4" />
  </Icon>
);

export const IconBuilding = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 17.5h14" />
    <path d="M4.5 17.5V4a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 12.5 4v13.5" />
    <path d="M12.5 8H15a1.5 1.5 0 0 1 1.5 1.5v8" />
    <path d="M7 6h2.5M7 9h2.5M7 12h2.5" />
  </Icon>
);

export const IconPlan = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 2.5h7L16 7v10.5H4.5z" />
    <path d="M11.5 2.5V7H16" />
    <path d="M7.5 11h5M7.5 14h3" />
  </Icon>
);

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 2.5 4 5v4.6c0 3.4 2.4 6.5 6 7.9 3.6-1.4 6-4.5 6-7.9V5z" />
    <path d="M7.8 10l1.5 1.6 3-3.4" />
  </Icon>
);

export const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 2.5 2.8 6.2 10 9.9l7.2-3.7z" />
    <path d="M2.8 10.2 10 13.9l7.2-3.7" />
    <path d="M2.8 14 10 17.7l7.2-3.7" />
  </Icon>
);

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.5 4.5 13 10l-5.5 5.5" />
  </Icon>
);

export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12.5 4.5 7 10l5.5 5.5" />
  </Icon>
);

export const IconMenu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 5.5h14M3 10h14M3 14.5h14" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Icon>
);

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
    <path d="M5.5 5.5 6 16a1.5 1.5 0 0 0 1.5 1.4h5A1.5 1.5 0 0 0 14 16l.5-10.5" />
    <path d="M8.5 8.5v6M11.5 8.5v6" />
  </Icon>
);

export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.2 3.3a1.8 1.8 0 0 1 2.5 2.5L7 14.5l-3.5 1 1-3.5z" />
  </Icon>
);

export const IconGrip = (p: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...p}>
    <circle cx="6" cy="4" r="1.35" />
    <circle cx="10" cy="4" r="1.35" />
    <circle cx="6" cy="8" r="1.35" />
    <circle cx="10" cy="8" r="1.35" />
    <circle cx="6" cy="12" r="1.35" />
    <circle cx="10" cy="12" r="1.35" />
  </svg>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 10.5 8 14l7.5-8" />
  </Icon>
);

export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 13V3.5M6.5 7 10 3.5 13.5 7" />
    <path d="M3.5 12.5v3a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-3" />
  </Icon>
);

export const IconSparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 2.5 11.6 7 16 8.6 11.6 10.2 10 14.7 8.4 10.2 4 8.6 8.4 7z" />
    <path d="M15 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </Icon>
);

export const IconGlobe = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M2.5 10h15" />
    <path d="M10 2.5c2 2.2 3 4.9 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.9-3-7.5s1-5.3 3-7.5z" />
  </Icon>
);

export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7.5" cy="7" r="2.8" />
    <path d="M2.8 16.5c0-2.6 2.1-4.4 4.7-4.4s4.7 1.8 4.7 4.4" />
    <path d="M13.5 5.2a2.6 2.6 0 0 1 0 5" />
    <path d="M14.8 12.4c1.5.5 2.6 1.9 2.6 3.6" />
  </Icon>
);

export const IconHelp = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M8 7.8a2.1 2.1 0 0 1 4 .7c0 1.4-2 1.6-2 3" />
    <path d="M10 14.2h.01" />
  </Icon>
);

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="8.8" width="11" height="7.2" rx="1.8" />
    <path d="M7.2 8.8V6.6a2.8 2.8 0 0 1 5.6 0v2.2" />
  </Icon>
);

/** Two stacked sheets: copying a configuration to another age band. */
export const IconCopy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="7" width="10.5" height="10.5" rx="2" />
    <path d="M13 4.5a2 2 0 0 0-2-2H4.5a2 2 0 0 0-2 2V11a2 2 0 0 0 2 2" />
  </Icon>
);
