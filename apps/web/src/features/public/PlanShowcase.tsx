import type { CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { IconCheck, IconChevronRight, IconShield } from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

/**
 * The three tiers the comparison really ranks — Basic, Standard, Premium —
 * drawn as a customer would see them on the results page, with the middle one
 * chosen. Figures are illustrative, deliberately round, and only the three
 * lines a plan is first judged on.
 */
const TIERS = [
  {
    name: 'Basic',
    coverage: 'In-patient',
    copayment: '20%',
    limit: 'EGP 250,000',
  },
  {
    name: 'Standard',
    coverage: 'In & out-patient',
    copayment: '10%',
    limit: 'EGP 500,000',
  },
  {
    name: 'Premium',
    coverage: 'In, out & dental',
    copayment: '0%',
    limit: 'EGP 1,000,000',
  },
] as const;

const CHOSEN = 1;

/**
 * INSURANCE, WITHOUT THE COMPLEXITY.
 *
 * The one picture of what the broker does: a person weighing plans, and the
 * plans themselves — three tier cards drifting in front of the desk, the
 * chosen one lifted and ticked. On a wide screen the photograph fills the
 * right half and dissolves into the page on its left and lower edges, so it
 * reads as part of the section rather than a picture dropped onto it. On a
 * phone the photograph becomes a full-width band that fades top and bottom,
 * and the cards line up beneath it.
 *
 * The photograph holds still. Only the cards float, slowly and out of step
 * with one another, and the tick on the chosen plan breathes — none of it
 * for anyone who has asked their device for less motion.
 */
export function PlanShowcase() {
  return (
    <section aria-labelledby="plan-showcase-heading" className="relative isolate overflow-hidden">
      {/* A faint pool of brand light behind the words. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 -left-40 size-[36rem] rounded-full bg-[radial-gradient(circle,var(--color-brand-soft)_0%,transparent_65%)]"
      />

      <Photograph className="lg:hidden" />

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:grid lg:min-h-[36rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:px-8">
        <div className="relative z-10 py-12 lg:py-24">
          <p className="text-brand text-xs font-bold tracking-[0.2em] uppercase">
            Smarter insurance, simply
          </p>
          <h2
            id="plan-showcase-heading"
            className="text-brand-strong mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl"
          >
            Insurance, without
            <br />
            the{' '}
            <span className="from-brand to-accent bg-linear-to-r bg-clip-text text-transparent">
              complexity.
            </span>
          </h2>
          <p className="text-content-muted mt-5 max-w-md text-base leading-relaxed sm:text-lg">
            We help you find the right coverage, compare your options and manage your insurance
            journey — all in one place.
          </p>
          <ButtonLink to={ROUTES.public.services} size="lg" className="mt-8">
            Explore our services
            <IconChevronRight className="size-4" />
          </ButtonLink>
        </div>

        <div className="relative pb-14 lg:flex lg:items-center lg:self-stretch lg:pb-0">
          <Photograph className="hidden lg:block" />
          <TierCards />
        </div>
      </div>
    </section>
  );
}

/**
 * The picture, with no frame: on a wide screen it runs to the right edge of
 * the viewport and thins away towards the words and the foot of the section;
 * on a phone it spans the width and fades in from the top and out at the
 * bottom. A trace of navy over it keeps it in the palette.
 */
function Photograph({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none',
        'max-lg:relative max-lg:-mb-16 max-lg:h-72 max-lg:[mask-image:linear-gradient(to_bottom,transparent,black_18%,black_70%,transparent)] sm:max-lg:h-96',
        'lg:absolute lg:inset-y-0 lg:-right-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:left-[-6rem] lg:[mask-composite:intersect] lg:[mask-image:linear-gradient(to_right,transparent,black_34%),linear-gradient(to_bottom,transparent,black_14%,black_72%,transparent)]',
        className,
      )}
    >
      <img
        src="/images/advisor.jpg"
        srcSet="/images/advisor-900.jpg 900w, /images/advisor.jpg 1800w"
        sizes="(min-width: 1024px) 60vw, 100vw"
        alt=""
        width={1800}
        height={1157}
        decoding="async"
        loading="lazy"
        className="size-full object-cover object-[72%_30%] lg:object-[70%_center]"
      />
      <div className="bg-brand-strong/25 absolute inset-0 mix-blend-multiply" />
      <div className="from-brand-strong/20 absolute inset-0 bg-linear-to-t to-transparent to-50%" />
    </div>
  );
}

function TierCards() {
  return (
    <ul
      aria-label="Example plan comparison"
      className="relative z-10 mx-auto grid w-full max-w-md grid-cols-3 gap-2.5 sm:gap-3 lg:mx-0 lg:ml-2 lg:max-w-[30rem] lg:items-end xl:ml-10"
    >
      {TIERS.map((tier, index) => {
        const chosen = index === CHOSEN;
        return (
          <li
            key={tier.name}
            className={cn('animate-showcase-float', chosen && 'lg:-translate-y-4')}
            style={{ '--float-delay': `${index * -2.1}s` } as CSSProperties}
          >
            <article
              className={cn(
                'relative rounded-(--radius-card) border p-3 backdrop-blur-md sm:p-4',
                chosen
                  ? 'bg-surface border-brand-border scale-[1.04] shadow-(--shadow-raised)'
                  : 'bg-surface/85 border-border-subtle shadow-(--shadow-card)',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    chosen ? 'bg-brand text-white' : 'bg-brand-soft text-brand-strong',
                  )}
                >
                  <IconShield className="size-4" />
                </span>
                <span className="text-content text-sm font-bold">{tier.name}</span>
              </div>
              {chosen ? (
                <span
                  aria-label="Chosen"
                  className="bg-accent text-brand-strong animate-showcase-pulse absolute -top-2.5 -right-2.5 flex size-6 items-center justify-center rounded-full ring-2 ring-white"
                >
                  <IconCheck className="size-3.5" strokeWidth={2.4} />
                </span>
              ) : null}

              <dl className="mt-3 space-y-2.5">
                <Row label="Coverage" value={tier.coverage} />
                <Row label="Co-payment" value={tier.copayment} />
                <Row label="Annual limit" value={tier.limit} />
              </dl>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-content-subtle text-[0.65rem] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-content mt-0.5 text-xs font-semibold tabular-nums sm:text-sm">{value}</dd>
    </div>
  );
}
