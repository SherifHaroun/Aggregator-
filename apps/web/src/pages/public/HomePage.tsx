import type { ComponentType, SVGProps } from 'react';
import { Link } from 'react-router-dom';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { IconCheck, IconGlobe, IconLayers, IconShield, IconSparkle } from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { useSession } from '@/features/auth/auth.api';
import { loginUrl } from '@/features/auth/guards';
import { useCompanies } from '@/features/insurance-data/insurance-data.api';
import { QuickCompareForm } from '@/features/public/QuickCompareForm';

/**
 * THE FRONT DOOR.
 *
 * What the old company site promised — fill in, compare, instant quotes —
 * done for real: the compare card runs the same engine the employees use,
 * against the same plans, and the three steps on the left are literally the
 * three steps. Below it, what the broker does, who it compares, and how to
 * get hold of a person.
 */
export function HomePage() {
  return (
    <>
      <Hero />
      <Steps />
      <Insurers />
      <Services />
      <FindAnAgent />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-brand-gradient relative overflow-hidden text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-[28rem] rounded-full bg-white/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 size-[22rem] rounded-full bg-white/5"
      />
      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:px-8 lg:py-20">
        <div>
          <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">
            Medical insurance, compared
          </p>
          <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Confused?
            <br />
            Best deals are a click away.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/80 sm:text-lg">
            Tell us who you want to insure and we compare every plan from every insurer we work with
            — instantly, side by side, with the price for your age.
          </p>

          <ol className="mt-10 space-y-5">
            {[
              ['Fill information', 'Who is being insured, how old, and where the cover applies.'],
              [
                'Compare insurance',
                'The best three plans in each tier — Basic, Standard, Premium.',
              ],
              ['Instant quotes', 'Open any plan in full, save it, and download it as a PDF.'],
            ].map(([title, detail], index) => (
              <li key={title} className="flex items-start gap-4">
                <span className="bg-accent text-brand-strong flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold shadow-(--shadow-card)">
                  {index + 1}
                </span>
                <div>
                  <p className="text-lg font-semibold">{title}</p>
                  <p className="text-sm text-white/70">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div id="compare" className="scroll-mt-24">
          <QuickCompareForm />
        </div>
      </div>
    </section>
  );
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const PROMISES: { icon: Icon; title: string; detail: string }[] = [
  {
    icon: IconSparkle,
    title: 'Every insurer, one screen',
    detail: 'Plans from every company on record, ranked by value.',
  },
  {
    icon: IconShield,
    title: 'Your price, not a brochure price',
    detail: 'Premiums worked out for your age or your workforce.',
  },
  {
    icon: IconCheck,
    title: 'Keep what you like',
    detail: 'Save plans to your cart and a Hadbrok adviser will call you.',
  },
];

function Steps() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {PROMISES.map(({ icon: Icon, title, detail }) => (
          <div
            key={title}
            className="bg-surface border-border-subtle flex gap-4 rounded-(--radius-card) border p-5 shadow-(--shadow-card)"
          >
            <span className="bg-brand-soft text-brand-strong flex size-11 shrink-0 items-center justify-center rounded-(--radius-control)">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-content font-semibold">{title}</p>
              <p className="text-content-muted mt-1 text-sm leading-relaxed">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The insurers on record, straight from the same database the admin fills in. */
function Insurers() {
  const companies = useCompanies({ isActive: true });
  const list = companies.data ?? [];
  if (list.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <h2 className="border-brand text-brand-strong shrink-0 border-l-4 pl-4 text-2xl font-extrabold tracking-tight uppercase lg:w-64">
          Supported and assisted by
        </h2>
        <ul className="bg-surface border-border-subtle flex flex-1 flex-wrap items-center justify-center gap-x-10 gap-y-6 rounded-(--radius-card) border px-6 py-6 shadow-(--shadow-card)">
          {list.map((company) => (
            <li key={company.id} className="flex items-center gap-3">
              <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="md" />
              <span className="text-content text-sm font-semibold">{company.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const SERVICES: { icon: Icon; title: string; tagline: string; detail: string }[] = [
  {
    icon: IconShield,
    title: 'Risks management',
    tagline: 'Risk it, go for it.',
    detail: 'Make sure that all the risks are evaluated, calculated and covered.',
  },
  {
    icon: IconLayers,
    title: 'Policy management',
    tagline: 'Better decision.',
    detail: 'Best market practice, local or international, for your security.',
  },
  {
    icon: IconSparkle,
    title: 'Premium management',
    tagline: 'Make sense of it.',
    detail:
      'Insurers that satisfy our standards of financial capability, service, quality and reactivity.',
  },
  {
    icon: IconGlobe,
    title: 'Claims management',
    tagline: 'Peace of mind.',
    detail: 'We assist you in case of a claim, through a comprehensive approach to settlement.',
  },
];

function Services() {
  return (
    <section id="services" className="scroll-mt-24 bg-surface-muted/60 py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:items-start">
          <h2 className="text-brand-strong text-3xl font-extrabold tracking-tight uppercase">
            Services
          </h2>
          <div className="border-brand max-w-3xl border-l-4 pl-5">
            <p className="text-content text-base leading-relaxed sm:text-lg">
              Hadbrok has been involved in the Egyptian market since 1982 as Paul Haddad Insurance
              Brokerage. It is Egypt’s leading insurance broker, working with the public and private
              sector — from private individuals to large conglomerates. Our objective is to make
              sure you understand your risk exposure and buy the required insurance, optimising your
              buying power and protection.
            </p>
            <Link
              to={ROUTES.public.services}
              className="text-brand mt-4 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              Everything we manage for you →
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ icon: Icon, title, tagline, detail }) => (
            <article
              key={title}
              className="group bg-surface border-border-subtle flex flex-col overflow-hidden rounded-(--radius-card) border shadow-(--shadow-card) transition-transform hover:-translate-y-1"
            >
              <div className="bg-brand-gradient flex h-28 items-center justify-center text-white">
                <Icon className="size-10 opacity-90 transition-transform group-hover:scale-110" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-brand-strong text-lg font-bold">{title}</h3>
                <p className="text-content-muted text-sm font-medium">{tagline}</p>
                <p className="text-content-muted mt-3 text-sm leading-relaxed">{detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FindAnAgent() {
  const session = useSession();
  const signedIn = session.data?.kind === 'customer';

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-brand-strong text-center text-3xl font-extrabold tracking-tight uppercase">
        Find an agent now
      </h2>
      <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
        <a
          href="tel:+201222352235"
          className="bg-brand-strong flex items-center gap-5 rounded-(--radius-card) p-7 text-white shadow-(--shadow-raised) transition-transform hover:-translate-y-0.5"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/10">
            <IconShield className="size-7" />
          </span>
          <span>
            <span className="block text-sm text-white/75">Call now</span>
            <span className="block text-2xl font-extrabold tabular-nums">+20 12 2235 2235</span>
            <span className="block text-xs text-white/60">9am to 5pm, Sunday to Thursday</span>
          </span>
        </a>
        <div className="bg-brand flex flex-col justify-center gap-3 rounded-(--radius-card) p-7 text-white shadow-(--shadow-raised)">
          <p className="text-sm text-white/80">Or let us call you</p>
          <p className="text-xl font-bold">
            {signedIn ? 'Save a plan and we will be in touch.' : 'Create your account in seconds.'}
          </p>
          <Link
            to={signedIn ? `${ROUTES.home}#compare` : loginUrl(ROUTES.home)}
            className="bg-accent text-brand-strong mt-1 inline-flex w-fit items-center rounded-(--radius-control) px-5 py-2.5 text-sm font-bold shadow-(--shadow-card)"
          >
            {signedIn ? 'Compare plans' : 'Log in / Sign up'}
          </Link>
        </div>
      </div>
    </section>
  );
}
