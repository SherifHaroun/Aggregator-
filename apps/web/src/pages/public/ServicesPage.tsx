import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { Link } from 'react-router-dom';
import {
  IconBuilding,
  IconCheck,
  IconChevronRight,
  IconDashboard,
  IconGlobe,
  IconLayers,
  IconShield,
  IconSparkle,
  IconUsers,
} from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { Photo } from '@/features/public/Photo';
import { cn } from '@/lib/cn';
import { PHONE_MOBILE, tel } from '@/pages/public/CompanyPages';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * SERVICES — how Hadbrok works and what it adds.
 *
 * Every sentence of substance on this page is the broker's own, carried over
 * from the company site word for word: the five-step client approach, the
 * objective, the four undertakings between client and insurer, and the four
 * areas of work with what each one covers. What is new is the shape — a
 * process to walk, a callout to stop at, cards to hover and panels to open —
 * so a visitor can take the page in at a glance and still read every line.
 */
export function ServicesPage() {
  return (
    <>
      <Hero />
      <ClientApproach />
      <Objective />
      <InsurerDynamics />
      <FocusAndProcess />
      <FinalCall />
    </>
  );
}

// --- Hero ------------------------------------------------------------------------------

function Hero() {
  return (
    <section className="bg-brand-strong relative isolate overflow-hidden text-white">
      {/* The photograph, dissolving into navy towards the words. */}
      <div
        aria-hidden
        className="absolute inset-0 lg:left-[30%] [mask-image:linear-gradient(to_right,transparent,black_45%)] max-lg:[mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
      >
        <Photo
          src="/images/services-hero.jpg"
          loading="eager"
          className="size-full object-cover object-[70%_center]"
        />
        <div className="from-brand-strong/70 absolute inset-0 bg-linear-to-r via-transparent to-transparent" />
        <div className="from-brand-strong absolute inset-x-0 bottom-0 h-40 bg-linear-to-t to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col justify-end px-4 pt-72 pb-16 sm:px-6 lg:min-h-[36rem] lg:justify-center lg:px-8 lg:py-24">
        <p className="text-accent flex items-center gap-4 text-xs font-bold tracking-[0.2em] uppercase">
          Services
          <span aria-hidden className="bg-accent/60 h-px w-16" />
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          Know-how and{' '}
          <span className="from-accent bg-linear-to-r to-white bg-clip-text text-transparent">
            added value
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
          Our objective is simple: every risk you carry is evaluated, quantified and covered, and
          every insurer we place you with earns the trust.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={ROUTES.public.contact}
            className="inline-flex items-center gap-2 rounded-(--radius-control) border border-white/40 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/15"
          >
            Talk to our team
            <IconChevronRight className="size-4" />
          </Link>
          <a
            href="#client-approach"
            className="inline-flex items-center rounded-(--radius-control) px-5 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:text-white"
          >
            How we work ↓
          </a>
        </div>
      </div>
    </section>
  );
}

// --- Client approach ---------------------------------------------------------------------

const APPROACH: { label: string; icon: Icon; text: string }[] = [
  {
    label: 'Identify',
    icon: IconSparkle,
    text: 'Identify possible non commercial risks which might have a financial damage on the professional activity.',
  },
  {
    label: 'Quantify',
    icon: IconDashboard,
    text: 'Quantify these risks using all necessary tools of risk measurement.',
  },
  {
    label: 'Grade',
    icon: IconLayers,
    text: 'Grade into hierarchy the risks by potential damage and eventual concurrency.',
  },
  { label: 'Reduce', icon: IconShield, text: 'Reduce all controllable risks.' },
  {
    label: 'Decide',
    icon: IconCheck,
    text: 'Decide either to retain the risk once evaluated or transfer it to an Insurance company.',
  },
];

function SectionHeading({
  eyebrow,
  title,
  lede,
  id,
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  id?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <p className="text-brand text-xs font-bold tracking-[0.2em] uppercase">{eyebrow}</p>
      <h2
        id={id}
        className="text-brand-strong mt-3 scroll-mt-24 text-3xl font-extrabold tracking-tight sm:text-4xl"
      >
        {title}
      </h2>
      {lede ? (
        <p className="text-content-muted mt-3 text-base leading-relaxed sm:text-lg">{lede}</p>
      ) : null}
    </div>
  );
}

/**
 * Five steps on one line, joined by a thread with a spark travelling along
 * it. The step under the pointer — or the keyboard, or the last one tapped —
 * comes forward with its explanation in full; the others wait in the
 * background, still legible. On a narrow screen the thread runs down the
 * left instead.
 */
function ClientApproach() {
  const [active, setActive] = useState(0);

  return (
    <section
      aria-labelledby="client-approach"
      className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <SectionHeading
        id="client-approach"
        eyebrow="Client approach"
        title="Five steps, every risk"
        lede="How we take a client’s risks apart before a single policy is placed."
      />

      <ol className="relative mt-12 grid gap-4 lg:grid-cols-5 lg:gap-0">
        {/* The thread. Horizontal on a wide screen, vertical on a narrow one. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-[1.6rem] w-px lg:top-[1.4rem] lg:right-[10%] lg:bottom-auto lg:left-[10%] lg:h-px lg:w-auto"
        >
          <div className="from-brand-border via-brand to-brand-border absolute inset-0 bg-linear-to-b lg:bg-linear-to-r" />
          <span className="bg-accent animate-approach-travel absolute top-0 left-1/2 size-2 -translate-x-1/2 rounded-full shadow-[0_0_12px_2px_var(--color-accent)] lg:top-1/2 lg:left-0 lg:-translate-y-1/2" />
        </div>

        {APPROACH.map(({ label, icon: Icon, text }, index) => {
          const current = index === active;
          return (
            <li key={label} className="relative lg:px-3">
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
                aria-pressed={current}
                className={cn(
                  'group flex w-full gap-4 rounded-(--radius-card) p-3 text-left transition-all duration-500 lg:flex-col lg:items-center lg:p-4 lg:text-center',
                  current
                    ? 'bg-surface/80 shadow-(--shadow-card) backdrop-blur-md lg:-translate-y-1'
                    : 'hover:bg-surface/50',
                )}
              >
                <span
                  className={cn(
                    'relative flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-500',
                    current
                      ? 'bg-brand-strong border-brand-strong text-white shadow-(--shadow-brand)'
                      : 'bg-canvas border-brand-border text-brand-strong',
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-content-subtle block text-[0.65rem] font-bold tracking-[0.2em] uppercase">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'block text-base font-extrabold tracking-tight uppercase transition-colors duration-500',
                      current ? 'text-brand-strong' : 'text-content',
                    )}
                  >
                    {label}
                  </span>
                  <span
                    className={cn(
                      'mt-2 block text-sm leading-relaxed transition-all duration-500',
                      current ? 'text-content' : 'text-content-muted lg:opacity-60',
                    )}
                  >
                    {text}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// --- Objective -----------------------------------------------------------------------------

function Objective() {
  return (
    <section aria-label="Our objective" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="bg-brand-gradient relative overflow-hidden rounded-(--radius-card) px-6 py-12 text-white shadow-(--shadow-raised) sm:px-10 lg:px-16 lg:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-white/5"
        />
        <div
          aria-hidden
          className="bg-accent/15 pointer-events-none absolute -bottom-40 -left-20 size-96 rounded-full blur-2xl"
        />
        <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">
              Our objective
            </p>
            <blockquote className="mt-4 max-w-3xl text-2xl leading-snug font-bold tracking-tight sm:text-3xl">
              “The objective of HB as an insurance broker is to make sure that all the risks of our
              clients are evaluated, calculated and covered.”
            </blockquote>
          </div>
          <ul className="flex flex-wrap gap-3 lg:flex-col">
            {['Evaluated', 'Calculated', 'Covered'].map((word) => (
              <li
                key={word}
                className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-md"
              >
                <IconCheck className="text-accent size-4" />
                {word}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// --- Client insurer dynamics -----------------------------------------------------------------

const DYNAMICS: { icon: Icon; title: string; text: string }[] = [
  {
    icon: IconShield,
    title: 'Replacement value',
    text: 'Make sure that insured risks are covered at the replacement value.',
  },
  {
    icon: IconGlobe,
    title: 'Market practice',
    text: 'Find the best market practice on the insurance market, either on the local market or the international market if necessary with the support of our world-wide network.',
  },
  {
    icon: IconDashboard,
    title: 'Insurer standards',
    text: 'Make sure that the insurer satisfies our standards of requirements in terms of financial capabilities, service, quality, and reactivity.',
  },
  {
    icon: IconUsers,
    title: 'Claim assistance',
    text: 'Assist the client in case of claim through a comprehensive approach to claim settlement.',
  },
];

function InsurerDynamics() {
  return (
    <section
      aria-labelledby="insurer-dynamics"
      className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <SectionHeading
        id="insurer-dynamics"
        eyebrow="Client insurer dynamics"
        title="Between you and the insurer"
        lede="Four undertakings we hold to on every placement."
      />
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {DYNAMICS.map(({ icon: Icon, title, text }, index) => (
          <li key={title}>
            <article className="group bg-surface border-border-subtle hover:border-brand-border relative flex h-full flex-col overflow-hidden rounded-(--radius-card) border p-6 shadow-(--shadow-card) transition-all duration-500 hover:-translate-y-1 hover:shadow-(--shadow-raised)">
              <div
                aria-hidden
                className="bg-brand-soft pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="relative flex items-start justify-between">
                <span className="bg-brand-soft text-brand-strong group-hover:bg-brand-strong flex size-12 items-center justify-center rounded-(--radius-control) transition-colors duration-500 group-hover:text-white">
                  <Icon className="size-6" />
                </span>
                <span className="text-content-subtle text-xs font-bold tracking-[0.2em]">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="text-brand-strong relative mt-5 text-lg font-bold">{title}</h3>
              <p className="text-content-muted relative mt-2 text-sm leading-relaxed">{text}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- Client focus and process ------------------------------------------------------------------

type Area = {
  icon: Icon;
  title: string;
  intro: string;
  groups: { title?: string; items: { label: string; detail?: string }[] }[];
  role: string;
};

const AREAS: Area[] = [
  {
    icon: IconShield,
    title: 'Risk Management',
    intro: 'Profile, control and transfer of every risk you carry.',
    groups: [
      { title: 'Risk profile', items: [{ label: 'Identification' }, { label: 'Evaluation' }] },
      {
        title: 'Risk control',
        items: [{ label: 'Elimination' }, { label: 'Reduction' }, { label: 'Prevention' }],
      },
      { title: 'Risk transfer', items: [{ label: 'External' }, { label: 'Internal' }] },
    ],
    role: 'To make sure that the insured risks are covered at the replacement value.',
  },
  {
    icon: IconUsers,
    title: 'Claims Management',
    intro: 'From first notice to settlement, one line of communication.',
    groups: [
      {
        items: [
          {
            label: 'Build shortest line of communication',
            detail: 'Insurers, Third party administrations, your company',
          },
          {
            label: 'Daily claim handling for conclusion to all claims',
            detail: 'Facilitate & resolve disputes',
          },
          {
            label: 'Statistics & Comparison for renewal strategy',
            detail: 'Handle losses below retention levels',
          },
        ],
      },
    ],
    role: 'To assist the client in case of claim through a comprehensive approach to claim settlement.',
  },
  {
    icon: IconLayers,
    title: 'Premium Management',
    intro: 'Invoicing, payment and local requirements, supervised end to end.',
    groups: [
      {
        items: [
          { label: 'Premium Invoicing' },
          { label: 'Supervision & Payment' },
          { label: 'Local Requirement & Taxes' },
        ],
      },
    ],
    role: 'To make sure that the insurer satisfies our standards of requirements in terms of financial capabilities, service, quality and reactivity.',
  },
  {
    icon: IconBuilding,
    title: 'Policy Management',
    intro: 'Wordings, renewals and new cover, taken off your desk.',
    groups: [
      {
        items: [
          { label: 'Reduces administrative burden', detail: 'Policies, Wordings, Procedures' },
          {
            label: 'Prepare effective renewal strategy',
            detail: 'Periodic review & updated Risk Information',
          },
          { label: 'New Coverage', detail: 'New exposure or sites' },
        ],
      },
    ],
    role: 'To find the best market practice on the insurance market, either on the local market or international market if necessary with the support of our worldwide network.',
  },
];

function FocusAndProcess() {
  return (
    <section
      aria-labelledby="focus-and-process"
      className="bg-surface-muted/60 border-border-subtle border-y py-16 lg:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="focus-and-process"
          eyebrow="Client focus and process"
          title="What we manage for you"
          lede="Four areas of work. Open any one to see exactly what it covers, and the part we play."
        />
        <ul className="mt-10 grid gap-5 lg:grid-cols-2">
          {AREAS.map((area) => (
            <li key={area.title}>
              <AreaPanel area={area} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * One area of work. Closed, it is an icon, a name and a line; a pointer
 * resting on it opens it, and a click or a keypress keeps it open (or, on a
 * touch screen, is the only way in). The detail unfolds rather than appears.
 */
function AreaPanel({ area }: { area: Area }) {
  const { icon: Icon, title, intro, groups, role } = area;
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;
  const id = `area-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'bg-surface border-border-subtle overflow-hidden rounded-(--radius-card) border shadow-(--shadow-card) transition-all duration-500',
        open && 'border-brand-border shadow-(--shadow-raised)',
      )}
    >
      <button
        type="button"
        onClick={() => setPinned((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-5 p-6 text-left"
      >
        <span
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-(--radius-control) transition-colors duration-500',
            open ? 'bg-brand-gradient text-white' : 'bg-brand-soft text-brand-strong',
          )}
        >
          <Icon className="size-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-brand-strong block text-xl font-extrabold tracking-tight">
            {title}
          </span>
          <span className="text-content-muted mt-1 block text-sm">{intro}</span>
        </span>
        <IconChevronRight
          className={cn(
            'text-content-subtle size-5 shrink-0 transition-transform duration-500',
            open && 'text-brand rotate-90',
          )}
        />
      </button>

      <div
        id={id}
        className={cn(
          'grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-border-subtle border-t px-6 pt-5 pb-6">
            <div className={cn('grid gap-5', groups.length > 1 && 'sm:grid-cols-3')}>
              {groups.map((group, index) => (
                <div key={group.title ?? index}>
                  {group.title ? (
                    <h4 className="text-brand text-xs font-bold tracking-[0.18em] uppercase">
                      {group.title}
                    </h4>
                  ) : null}
                  <ul className={cn('space-y-2.5', group.title && 'mt-3')}>
                    {group.items.map(({ label, detail }) => (
                      <li key={label} className="flex gap-3">
                        <IconCheck className="text-brand mt-1 size-4 shrink-0" />
                        <span>
                          <span className="text-content block text-sm font-semibold">{label}</span>
                          {detail ? (
                            <span className="text-content-muted block text-xs leading-relaxed">
                              {detail}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Role>{role}</Role>
          </div>
        </div>
      </div>
    </article>
  );
}

function Role({ children }: { children: ReactNode }) {
  return (
    <div className="bg-brand-soft/60 mt-6 rounded-(--radius-control) p-4">
      <p className="text-brand text-[0.65rem] font-bold tracking-[0.18em] uppercase">Our role</p>
      <p className="text-brand-strong mt-1 text-sm leading-relaxed font-medium">{children}</p>
    </div>
  );
}

// --- Final call ----------------------------------------------------------------------------------

function FinalCall() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="bg-brand-strong relative overflow-hidden rounded-(--radius-card) px-6 py-12 text-center text-white shadow-(--shadow-raised) sm:px-10 lg:py-16">
        <div
          aria-hidden
          className="bg-accent/20 pointer-events-none absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full blur-3xl"
        />
        <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">
          Let’s protect what matters.
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">
          Talk to one of our team about the risks you carry, or compare the plans on the market in a
          minute.
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={ROUTES.public.contact}
            className="bg-accent text-brand-strong inline-flex items-center gap-2 rounded-(--radius-control) px-6 py-3 text-sm font-bold shadow-(--shadow-card) transition-transform hover:scale-[1.02]"
          >
            Talk to our team
            <IconChevronRight className="size-4" />
          </Link>
          <a
            href={tel(PHONE_MOBILE)}
            className="inline-flex items-center rounded-(--radius-control) border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Call {PHONE_MOBILE}
          </a>
        </div>
      </div>
    </section>
  );
}
