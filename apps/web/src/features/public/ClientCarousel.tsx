import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { IconChevronLeft, IconChevronRight, IconPause, IconPlay } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

type Client = {
  name: string;
  /** Intrinsic size of the file, so the slot is reserved before it loads. */
  logo?: { src: string; width: number; height: number };
};

/**
 * The companies Hadbrok looks after, as on the old site's "Our clients".
 *
 * Files live in `public/clients/`. A client without a file yet is set in
 * type instead, so the row never shows a broken image.
 */
export const CLIENTS: Client[] = [
  { name: 'Jumia', logo: { src: '/clients/jumia.png', width: 276, height: 64 } },
  { name: 'Lecico', logo: { src: '/clients/lecico.png', width: 356, height: 107 } },
  { name: 'Accor Hotels', logo: { src: '/clients/accor.png', width: 502, height: 99 } },
  { name: 'Carrefour', logo: { src: '/clients/carrefour.png', width: 149, height: 119 } },
  {
    name: 'Fairmont Hotels & Resorts',
    logo: { src: '/clients/fairmont.png', width: 378, height: 133 },
  },
  { name: '30 North' },
];

/** Drift speed in CSS pixels per second — slow enough to read every mark. */
const DRIFT_SPEED = 32;
/** How long an arrow or dot takes to bring a logo into place. */
const STEP_DURATION = 750;
/** Movement before a press becomes a drag; anything less is still a click. */
const DRAG_THRESHOLD = 6;
/** The faded edges, as a share of the viewport — kept in step with the mask. */
const EDGE_FADE = 0.12;

/**
 * Logos come in every shape — Carrefour is nearly square, Accor five times
 * wider than tall. Sizing them all to one height makes the wide ones shout,
 * so each gets roughly the same AREA instead, capped so none overflows.
 */
function logoBox(width: number, height: number) {
  const area = 7200;
  const ratio = width / height;
  let h = Math.sqrt(area / ratio);
  let w = h * ratio;
  if (h > 64) [h, w] = [64, 64 * ratio];
  if (w > 190) [w, h] = [190, 190 / ratio];
  return { width: Math.round(w), height: Math.round(h) };
}

const mod = (value: number, size: number) => ((value % size) + size) % size;
/** The tour's easing: quick to start, long gentle settle. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

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
 * OUR CLIENTS.
 *
 * A single band of logos drifting right to left, forever. The set is rendered
 * as many times as it takes to cover the band, and the offset wraps at the
 * width of one set — the copies are identical, so the wrap cannot be seen.
 *
 * One animation loop owns the offset, and everything feeds into it: the
 * drift, an arrow or dot easing to a logo, a finger dragging the band and
 * the glide after it lets go. Movement pauses while the pointer rests on the
 * band, while the keyboard is inside it, when the visitor presses pause, and
 * from the start for anyone who has asked their device for less motion.
 */
export function ClientCarousel({ clients = CLIENTS }: { clients?: Client[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const autoplay = userPaused === null ? !reducedMotion : !userPaused;

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [copies, setCopies] = useState(3);
  const [active, setActive] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const firstSetRef = useRef<HTMLUListElement>(null);

  /** Mutable state the frame loop reads — kept out of React so it never re-renders per frame. */
  const engine = useRef({
    offset: 0,
    setWidth: 0,
    viewportWidth: 0,
    starts: [] as number[],
    velocity: 0,
    tween: null as null | { from: number; to: number; start: number; duration: number },
    drag: null as null | {
      pointerId: number;
      startX: number;
      startOffset: number;
      lastX: number;
      lastTime: number;
      moved: boolean;
    },
    suppressClick: false,
    drifting: false,
    visible: true,
  });

  const drifting = autoplay && !hovered && !focused;
  engine.current.drifting = drifting;

  // Measure one set, where each logo starts in it, and how many copies cover the band.
  useLayoutEffect(() => {
    const set = firstSetRef.current;
    const viewport = viewportRef.current;
    if (!set || !viewport) return;

    const measure = () => {
      const state = engine.current;
      // Fractional sizes: logos scale by a factor, and a width rounded to the
      // pixel would show as a small jump every time the loop wraps.
      const bounds = set.getBoundingClientRect();
      state.setWidth = bounds.width;
      state.viewportWidth = viewport.clientWidth;
      state.starts = Array.from(set.children, (item) => {
        const first = (item.firstElementChild ?? item).getBoundingClientRect();
        return first.left - bounds.left;
      });
      if (state.setWidth > 0) {
        setCopies(Math.max(2, Math.ceil(state.viewportWidth / state.setWidth) + 1));
      }
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(set);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [clients]);

  // Stop the loop while the band is scrolled out of sight.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      engine.current.visible = entry?.isIntersecting ?? true;
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // The frame loop.
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return;
    let frame = 0;
    let last = performance.now();
    let applied = Number.NaN;

    const tick = (now: number) => {
      // A long gap (background tab) must not turn into a leap.
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      const state = engine.current;

      if (state.visible && state.setWidth > 0) {
        if (state.tween) {
          const t = Math.min((now - state.tween.start) / state.tween.duration, 1);
          state.offset = state.tween.from + (state.tween.to - state.tween.from) * easeOut(t);
          if (t === 1) state.tween = null;
        } else if (!state.drag && Math.abs(state.velocity) > 4) {
          state.offset += state.velocity * dt;
          // A short, soft glide — a fling nudges the band, it never races.
          state.velocity *= Math.pow(0.01, dt);
        } else if (!state.drag) {
          state.velocity = 0;
          if (state.drifting) state.offset += DRIFT_SPEED * dt;
        }

        const position = mod(state.offset, state.setWidth);
        if (position !== applied && trackRef.current) {
          applied = position;
          trackRef.current.style.transform = `translate3d(${-position}px, 0, 0)`;
          setActive(currentIndex(state, position));
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const moveBy = useCallback(
    (distance: number) => {
      const state = engine.current;
      state.velocity = 0;
      if (reducedMotion || typeof requestAnimationFrame === 'undefined') {
        state.tween = null;
        state.offset += distance;
        if (trackRef.current && state.setWidth > 0) {
          const position = mod(state.offset, state.setWidth);
          trackRef.current.style.transform = `translate3d(${-position}px, 0, 0)`;
          setActive(currentIndex(state, position));
        }
        return;
      }
      state.tween = {
        from: state.offset,
        to: state.offset + distance,
        start: performance.now(),
        duration: STEP_DURATION,
      };
    },
    [reducedMotion],
  );

  /** The tween's destination, if one is running — so quick presses add up. */
  const settledOffset = () => engine.current.tween?.to ?? engine.current.offset;

  const step = useCallback(
    (direction: 1 | -1) => {
      const state = engine.current;
      if (!state.setWidth || state.starts.length === 0) return;
      const anchor = state.viewportWidth * EDGE_FADE;
      const position = mod(settledOffset(), state.setWidth);
      const distances = state.starts.map((start) => {
        const d =
          direction === 1
            ? mod(start - position - anchor, state.setWidth)
            : mod(position + anchor - start, state.setWidth);
        return d < 2 ? d + state.setWidth : d;
      });
      const nearest = Math.min(...distances);
      moveBy(direction * nearest + (settledOffset() - state.offset));
    },
    [moveBy],
  );

  const goTo = useCallback(
    (index: number) => {
      const state = engine.current;
      const start = state.starts[index];
      if (!state.setWidth || start === undefined) return;
      const anchor = state.viewportWidth * EDGE_FADE;
      const position = mod(settledOffset(), state.setWidth);
      const half = state.setWidth / 2;
      const delta = mod(start - position - anchor + half, state.setWidth) - half;
      moveBy(delta + (settledOffset() - state.offset));
    },
    [moveBy],
  );

  // --- Swipe and drag -------------------------------------------------------

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const state = engine.current;
    state.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startOffset: state.offset,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      moved: false,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = engine.current;
    const drag = state.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;

    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      // Only now is it a drag: a press that stays put remains an ordinary click.
      drag.moved = true;
      state.tween = null;
      drag.startOffset = state.offset + dx;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is already gone (or synthetic); the drag still follows moves.
      }
      event.currentTarget.dataset.dragging = '';
    }

    const elapsed = Math.max(event.timeStamp - drag.lastTime, 1) / 1000;
    state.velocity = Math.max(-1000, Math.min(1000, -(event.clientX - drag.lastX) / elapsed));
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
    state.offset = drag.startOffset - dx;
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const state = engine.current;
    const drag = state.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    state.drag = null;
    delete event.currentTarget.dataset.dragging;
    if (drag.moved) {
      state.suppressClick = true;
      // A finger that stopped before lifting should not fling the band.
      if (event.timeStamp - drag.lastTime > 80) state.velocity = 0;
      if (reducedMotion) state.velocity = 0;
    }
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!engine.current.suppressClick) return;
    engine.current.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  }

  return (
    <section
      aria-labelledby="our-clients-heading"
      className="relative overflow-hidden pt-20 pb-6 [--logo-scale:0.72] sm:[--logo-scale:0.86] lg:[--logo-scale:1]"
    >
      {/* A faint pool of light for the logos to travel through. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-72 -translate-y-1/3 bg-[radial-gradient(ellipse_at_center,var(--color-brand-soft)_0%,transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-brand text-center text-xs font-bold tracking-[0.2em] uppercase">
          Trusted by
        </p>
        <h2
          id="our-clients-heading"
          className="text-brand-strong mt-3 text-center text-3xl font-extrabold tracking-tight uppercase"
        >
          Our clients
        </h2>
        <p className="text-content-muted mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed sm:text-base">
          Organisations across Egypt that rely on Hadbrok to insure their people and their business.
        </p>

        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Client logos"
          className="mt-12"
          onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
          onPointerLeave={(event) => event.pointerType === 'mouse' && setHovered(false)}
          onFocus={(event) => setFocused(isKeyboardFocus(event.target))}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setFocused(false);
          }}
          onKeyDown={onKeyDown}
        >
          <div className="relative">
            <div
              ref={viewportRef}
              className="relative cursor-grab touch-pan-y overflow-hidden py-6 select-none data-dragging:cursor-grabbing [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onPointerLeave={onPointerEnd}
              onClickCapture={onClickCapture}
            >
              <div ref={trackRef} className="flex w-max will-change-transform">
                {Array.from({ length: copies }, (_, copy) => (
                  <ul
                    key={copy}
                    ref={copy === 0 ? firstSetRef : undefined}
                    aria-hidden={copy === 0 ? undefined : true}
                    className="flex shrink-0 items-center"
                  >
                    {clients.map((client) => (
                      <li
                        key={client.name}
                        className="flex h-20 shrink-0 items-center px-7 sm:px-10 lg:px-12"
                      >
                        <ClientMark client={client} />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>

            {/* On a phone the band is too narrow to share with arrows; they join the dots below. */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-between sm:flex">
              <ArrowButton label="Previous client" onClick={() => step(-1)}>
                <IconChevronLeft className="size-5" />
              </ArrowButton>
              <ArrowButton label="Next client" onClick={() => step(1)}>
                <IconChevronRight className="size-5" />
              </ArrowButton>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <ArrowButton
              label="Previous client"
              onClick={() => step(-1)}
              className="size-9 sm:hidden"
            >
              <IconChevronLeft className="size-4" />
            </ArrowButton>
            <div className="flex items-center" role="group" aria-label="Choose a client">
              {clients.map((client, index) => (
                <button
                  key={client.name}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Show ${client.name}`}
                  aria-current={index === active ? 'true' : undefined}
                  className="group flex size-6 items-center justify-center rounded-full"
                >
                  <span
                    className={cn(
                      'block h-1.5 rounded-full transition-all duration-500',
                      index === active
                        ? 'bg-brand-strong w-5'
                        : 'bg-border-strong group-hover:bg-brand-border w-1.5',
                    )}
                  />
                </button>
              ))}
            </div>
            <ArrowButton label="Next client" onClick={() => step(1)} className="size-9 sm:hidden">
              <IconChevronRight className="size-4" />
            </ArrowButton>
            <span aria-hidden className="bg-border-subtle h-4 w-px" />
            <button
              type="button"
              onClick={() => setUserPaused(autoplay)}
              aria-label={autoplay ? 'Pause the moving logos' : 'Play the moving logos'}
              className="text-content-muted hover:text-brand-strong hover:bg-brand-soft flex size-8 items-center justify-center rounded-full transition-colors"
            >
              {autoplay ? <IconPause className="size-4" /> : <IconPlay className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Which logo sits nearest the inner edge of the left fade. */
function currentIndex(
  state: { starts: number[]; setWidth: number; viewportWidth: number },
  position: number,
) {
  const anchor = state.viewportWidth * EDGE_FADE;
  const half = state.setWidth / 2;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  state.starts.forEach((start, index) => {
    const distance = Math.abs(mod(start - position - anchor + half, state.setWidth) - half);
    if (distance < bestDistance) [best, bestDistance] = [index, distance];
  });
  return best;
}

function isKeyboardFocus(target: EventTarget) {
  try {
    return (target as Element).matches(':focus-visible');
  } catch {
    return true;
  }
}

function ClientMark({ client }: { client: Client }) {
  const markClass =
    'block opacity-85 transition-[opacity,transform] duration-500 hover:scale-105 hover:opacity-100';

  if (!client.logo) {
    return (
      <span
        className={cn(
          markClass,
          'text-content font-serif text-[calc(1.75rem*var(--logo-scale))] leading-none font-semibold tracking-[0.12em] whitespace-nowrap uppercase',
        )}
      >
        {client.name}
      </span>
    );
  }

  const box = logoBox(client.logo.width, client.logo.height);
  return (
    <img
      src={client.logo.src}
      alt={client.name}
      width={client.logo.width}
      height={client.logo.height}
      draggable={false}
      decoding="async"
      className={cn(markClass, 'max-w-none object-contain')}
      style={{
        width: `calc(${box.width}px * var(--logo-scale))`,
        height: `calc(${box.height}px * var(--logo-scale))`,
      }}
    />
  );
}

function ArrowButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'bg-surface/90 border-border-subtle text-brand-strong hover:bg-brand-strong pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full border shadow-(--shadow-card) backdrop-blur transition-colors hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  );
}
