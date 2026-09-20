import { IconPin } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

/** The office on Google Maps: the broker's own listing, so reviews and hours come with it. */
export const MAP_URL = 'https://maps.app.goo.gl/2xSib6voNepJgjyaA';

/**
 * WHERE THE OFFICE IS, one tap from directions.
 *
 * Shown wherever the opening hours are: somebody reading "9am to 5pm" is
 * deciding whether to come by, and the next thing they need is the way there.
 * One component so the address and the link are the same in the footer, on
 * the contact page and after a plan is chosen.
 *
 * `dark` sits on the navy bands as frosted glass; `light` sits on a white card.
 */
export function LocationChip({
  address,
  tone = 'dark',
  className,
}: {
  address: string;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <a
      href={MAP_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open our office in Google Maps: ${address}`}
      className={cn(
        'group inline-flex max-w-full items-center gap-3.5 rounded-2xl border p-2.5 pr-5 text-left transition-all duration-300 hover:-translate-y-0.5',
        dark
          ? 'hover:border-accent/60 border-white/15 bg-white/[0.07] text-white shadow-[0_8px_30px_rgb(0_0_0/0.18)] backdrop-blur-md hover:bg-white/[0.12]'
          : 'border-border-subtle text-content hover:border-brand/40 bg-surface-muted/60 hover:bg-surface hover:shadow-(--shadow-raised)',
        className,
      )}
    >
      <span className="relative flex size-11 shrink-0 items-center justify-center">
        {/* A slow ripple under the pin, the way a map marks "you are going here". */}
        <span
          aria-hidden
          className="bg-accent/50 absolute inset-1 rounded-xl motion-safe:animate-ping motion-safe:[animation-duration:2.4s]"
        />
        <span className="from-accent to-brand relative flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-(--shadow-brand) transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-6">
          <IconPin className="size-5" />
        </span>
      </span>

      <span className="min-w-0">
        <span
          className={cn(
            'block text-[0.65rem] font-bold tracking-[0.18em] uppercase',
            dark ? 'text-accent' : 'text-brand',
          )}
        >
          Find us
        </span>
        <span className="block text-sm leading-snug font-medium">{address}</span>
        <span
          className={cn(
            'mt-0.5 inline-flex items-center gap-1 text-xs font-semibold',
            dark
              ? 'text-white/70 group-hover:text-white'
              : 'text-content-muted group-hover:text-brand',
          )}
        >
          Open in Google Maps
          <span
            aria-hidden
            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          >
            ↗
          </span>
        </span>
      </span>
    </a>
  );
}
