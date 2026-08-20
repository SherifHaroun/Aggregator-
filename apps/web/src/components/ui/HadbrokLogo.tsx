import { cn } from '@/lib/cn';

/**
 * The Hadbrok mark.
 *
 * Drawn rather than loaded, so it stays sharp at any size, needs no network
 * request and cannot flash in late on the splash screen. The serif stack is
 * deliberately system-only for the same reason — nothing here waits on a web
 * font.
 *
 * To use the supplied artwork instead, drop the file in `apps/web/public/` and
 * swap this component for an `<img>`; every caller passes the same sizing
 * classes, so nothing else changes.
 */
const SERIF = "Georgia, 'Times New Roman', Times, serif";

/** The navy the brand is set on. */
export const HADBROK_NAVY = '#17244b';

export function HadbrokLogo({
  variant = 'wide',
  withBackdrop = true,
  className,
  title = 'Hadbrok Insurance Brokers',
}: {
  /**
   * `wide` is the full lock-up, `stacked` the square one, and `name` just the
   * wordmark — used where the lock-up would be too small for "Insurance
   * Brokers" to be read rather than merely seen.
   */
  variant?: 'wide' | 'stacked' | 'name';
  /** Draw the navy panel behind the wordmark. */
  withBackdrop?: boolean;
  className?: string;
  title?: string;
}) {
  if (variant === 'name') {
    return (
      <svg viewBox="0 0 320 76" role="img" aria-label={title} className={cn('block', className)}>
        {withBackdrop ? <rect width="320" height="76" fill={HADBROK_NAVY} /> : null}
        <text
          x="160"
          y="52"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily={SERIF}
          fontSize="44"
          letterSpacing="1.5"
        >
          HADBROK
        </text>
      </svg>
    );
  }

  const wide = variant === 'wide';
  const width = wide ? 320 : 240;
  const height = wide ? 116 : 240;

  // Vertical rhythm of the lock-up: name, rule, then the descriptor.
  const nameY = wide ? 52 : 118;
  const ruleY = wide ? 68 : 138;
  const descriptorY = wide ? 96 : 178;
  const inset = wide ? 26 : 34;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title}
      className={cn('block', className)}
    >
      {withBackdrop ? <rect width={width} height={height} fill={HADBROK_NAVY} /> : null}

      <text
        x={width / 2}
        y={nameY}
        textAnchor="middle"
        fill="#ffffff"
        fontFamily={SERIF}
        fontSize={wide ? 44 : 52}
        letterSpacing={wide ? 1.5 : 2}
      >
        HADBROK
      </text>

      <rect x={inset} y={ruleY} width={width - inset * 2} height={wide ? 3 : 4} fill="#ffffff" />

      <text
        x={width / 2}
        y={descriptorY}
        textAnchor="middle"
        fill="#ffffff"
        fontFamily={SERIF}
        fontSize={wide ? 19 : 22}
        letterSpacing={wide ? 4.5 : 5}
      >
        Insurance Brokers
      </text>
    </svg>
  );
}
