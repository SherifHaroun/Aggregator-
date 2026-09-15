import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useCompanies } from '@/features/insurance-data/insurance-data.api';
import { resolveAssetUrl } from '@/lib/api-url';

type StreamLogo = {
  name: string;
  src?: string | null;
  /** Intrinsic size when known up front; otherwise read once the file loads. */
  width?: number;
  height?: number;
};

/**
 * The companies Hadbrok looks after. Files live in `public/clients/`; a
 * client without a file yet is set in type, never shown as a broken image.
 */
export const CLIENTS: StreamLogo[] = [
  { name: 'Jumia', src: '/clients/jumia.png', width: 276, height: 64 },
  { name: 'Lecico', src: '/clients/lecico.png', width: 356, height: 107 },
  { name: 'Accor Hotels', src: '/clients/accor.png', width: 502, height: 99 },
  { name: 'Carrefour', src: '/clients/carrefour.png', width: 149, height: 119 },
  { name: 'Fairmont Hotels & Resorts', src: '/clients/fairmont.png', width: 378, height: 133 },
  { name: '30 North' },
];

/** Drift in CSS pixels per second. Close enough to read as one section, not a race. */
const INSURER_SPEED = 24;
const CLIENT_SPEED = 30;

/**
 * The soft edges. Wide on a desktop, a fifth of the band on a phone, so logos
 * always ease in from the right and dissolve on the left rather than cut off.
 */
const FADE = 'min(22%, 18rem)';
const EDGE_MASK = `linear-gradient(90deg, transparent 0, #000 ${FADE}, #000 calc(100% - ${FADE}), transparent 100%)`;
const maskStyle: CSSProperties = { maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK };

/**
 * TRUSTED BY.
 *
 * Two streams of logos flowing right to left without end: the insurers
 * Hadbrok compares — straight from the companies the admin keeps, logos and
 * all — and the companies across Egypt that Hadbrok looks after. Each row runs
 * on its own, the second a touch quicker, so the section breathes.
 */
export function TrustedLogos() {
  const companies = useCompanies({ isActive: true });
  const insurers = useMemo<StreamLogo[]>(
    () =>
      (companies.data ?? []).map((company) => ({
        name: company.name,
        src: resolveAssetUrl(company.logoUrl),
      })),
    [companies.data],
  );
  const showInsurers = companies.isPending || insurers.length > 0;

  return (
    <section
      aria-label="Trusted by"
      className="bg-surface border-border-subtle overflow-hidden border-y py-16 [--logo-scale:0.74] sm:py-20 sm:[--logo-scale:0.88] lg:[--logo-scale:1]"
    >
      {showInsurers ? (
        <LogoStream title="Trusted insurance providers" logos={insurers} speed={INSURER_SPEED} />
      ) : null}
      <LogoStream
        title="Trusted by leading companies across Egypt"
        logos={CLIENTS}
        speed={CLIENT_SPEED}
        className={showInsurers ? 'mt-16 sm:mt-20' : undefined}
      />
    </section>
  );
}

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches,
  );
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const update = () => setReduced(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * ONE STREAM.
 *
 * The track holds two identical halves and slides left by exactly one half,
 * forever, at a constant speed — the moment it wraps, the second half sits
 * precisely where the first began, so the loop has no seam to see. Each half
 * repeats the logos as often as it takes to span the band, so the stream is
 * never short of logos however wide the screen.
 *
 * The movement is a Web Animation on `transform`, so the browser runs it off
 * the main thread. When the band is resized, or a logo finishes loading and
 * the row grows, the duration is recomputed to keep the same speed — and the
 * animation keeps its place in the cycle rather than starting again.
 */
function LogoStream({
  title,
  logos,
  speed,
  className,
}: {
  title: string;
  logos: StreamLogo[];
  speed: number;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [repeats, setRepeats] = useState(1);
  const bandRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLUListElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const identity = logos.map((logo) => `${logo.name}:${logo.src ?? ''}`).join('|');

  useLayoutEffect(() => {
    const band = bandRef.current;
    const set = setRef.current;
    const track = trackRef.current;
    if (reducedMotion || !band || !set || !track || typeof track.animate !== 'function') return;

    const sync = () => {
      const setWidth = set.getBoundingClientRect().width;
      if (setWidth <= 0) return;
      const needed = Math.max(1, Math.ceil(band.clientWidth / setWidth));
      setRepeats(needed);
      const duration = ((setWidth * needed) / speed) * 1000;

      const running = animationRef.current;
      if (!running) {
        animationRef.current = track.animate(
          [{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-50%, 0, 0)' }],
          { duration, iterations: Infinity, easing: 'linear' },
        );
        return;
      }
      const previous = Number(running.effect?.getTiming().duration) || duration;
      if (Math.abs(previous - duration) < 1) return;
      const progress = ((Number(running.currentTime) || 0) % previous) / previous;
      running.effect?.updateTiming({ duration });
      running.currentTime = progress * duration;
    };

    sync();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(sync);
    observer.observe(band);
    observer.observe(set);
    return () => {
      observer.disconnect();
      animationRef.current?.cancel();
      animationRef.current = null;
    };
  }, [reducedMotion, speed, identity]);

  const heading = (
    <h2 className="text-brand-strong px-4 text-center text-2xl font-extrabold tracking-tight uppercase sm:text-3xl">
      {title}
    </h2>
  );

  // Asked for less motion: the same logos, still, centred and wrapping.
  if (reducedMotion) {
    return (
      <div className={className}>
        {heading}
        <ul className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-center gap-y-8 px-4">
          {logos.map((logo) => (
            <LogoItem key={logo.name} logo={logo} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={className}>
      {heading}
      <div ref={bandRef} className="relative mt-10 min-h-20 overflow-hidden" style={maskStyle}>
        <div ref={trackRef} className="flex w-max will-change-transform">
          {[0, 1].map((half) =>
            Array.from({ length: repeats }, (_, repeat) => {
              const first = half === 0 && repeat === 0;
              return (
                <ul
                  key={`${half}-${repeat}`}
                  ref={first ? setRef : undefined}
                  // Screen readers hear each name once, not once per copy.
                  aria-hidden={first ? undefined : true}
                  className="flex shrink-0 items-center"
                >
                  {logos.map((logo) => (
                    <LogoItem key={logo.name} logo={logo} />
                  ))}
                </ul>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Logos come in every shape — Carrefour nearly square, Accor five times wider
 * than tall. One shared height would make the wide ones shout, so each gets
 * roughly the same AREA instead, capped so none towers or sprawls.
 */
function logoBox(width: number, height: number) {
  const ratio = width / height;
  let h = Math.sqrt(6400 / ratio);
  let w = h * ratio;
  if (h > 60) [h, w] = [60, 60 * ratio];
  if (w > 176) [w, h] = [176, 176 / ratio];
  return { width: w, height: h };
}

function LogoItem({ logo }: { logo: StreamLogo }) {
  const [natural, setNatural] = useState(
    logo.width && logo.height ? { width: logo.width, height: logo.height } : null,
  );
  const [failed, setFailed] = useState(false);

  return (
    <li className="flex h-20 shrink-0 items-center px-8 sm:px-11 lg:px-14">
      {logo.src && !failed ? (
        <img
          src={logo.src}
          alt={logo.name}
          draggable={false}
          decoding="async"
          onLoad={(event) => {
            const image = event.currentTarget;
            if (!natural && image.naturalWidth && image.naturalHeight) {
              setNatural({ width: image.naturalWidth, height: image.naturalHeight });
            }
          }}
          onError={() => setFailed(true)}
          className="block max-w-none object-contain transition-opacity duration-700 select-none"
          style={
            natural
              ? (() => {
                  const box = logoBox(natural.width, natural.height);
                  return {
                    width: `calc(${box.width}px * var(--logo-scale))`,
                    height: `calc(${box.height}px * var(--logo-scale))`,
                  };
                })()
              : { height: 'calc(40px * var(--logo-scale))', opacity: 0 }
          }
        />
      ) : (
        <span className="text-brand-strong text-[calc(1.4rem*var(--logo-scale))] leading-none font-extrabold tracking-tight whitespace-nowrap">
          {logo.name}
        </span>
      )}
    </li>
  );
}
