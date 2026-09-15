import type { ComponentType, SVGProps } from 'react';
import { Link } from 'react-router-dom';
import {
  IconBuilding,
  IconChevronRight,
  IconShield,
  IconSparkle,
  IconUsers,
} from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { Photo } from '@/features/public/Photo';
import { cn } from '@/lib/cn';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type Solution = {
  title: string;
  icon: Icon;
  photo: string;
  /** Where in the photograph to keep in frame as it rises. */
  focus: string;
  detail: string;
  action: { label: string; to: string };
  comingSoon?: boolean;
};

/**
 * What Hadbrok insures, in the words the footer already uses — medical cover
 * for one person, a family or a business — and the one line on its way.
 * Photographs live in `public/images/solutions/`.
 */
const SOLUTIONS: Solution[] = [
  {
    title: 'Individual insurance',
    icon: IconShield,
    photo: '/images/solutions/individual.jpg',
    focus: 'object-[50%_20%]',
    detail:
      'Medical cover for you alone, compared across every insurer we work with and priced for your age.',
    action: { label: 'Compare plans', to: `${ROUTES.home}#compare` },
  },
  {
    title: 'Family insurance',
    icon: IconUsers,
    photo: '/images/solutions/family.jpg',
    focus: 'object-[35%_35%]',
    detail:
      'One policy for the whole household, parents and children together, with the best three plans in each tier.',
    action: { label: 'Compare plans', to: `${ROUTES.home}#compare` },
  },
  {
    title: 'SME insurance',
    icon: IconBuilding,
    photo: '/images/solutions/sme.jpg',
    focus: 'object-[55%_30%]',
    detail:
      'Group medical cover for your team, priced on the ages of your workforce rather than a brochure rate.',
    action: { label: 'Compare plans', to: `${ROUTES.home}#compare` },
  },
  {
    title: 'Motor insurance',
    icon: IconSparkle,
    photo: '/images/solutions/motor.jpg',
    focus: 'object-[40%_50%]',
    detail:
      'Cover for your vehicle is on its way. Leave your details and we will tell you the moment it is live.',
    action: { label: 'Register interest', to: ROUTES.public.contact },
    comingSoon: true,
  },
];

/**
 * INSURANCE SOLUTIONS.
 *
 * Four tall photographs, each with only its name showing. Resting a pointer
 * on one lifts the photograph and brings up, from beneath it, what the cover
 * is and where to go next — the way a premium site reveals rather than
 * labels. Keyboard focus opens a card the same way, and on a screen with no
 * pointer to rest, every card is already open: nothing is hidden behind a
 * gesture a finger cannot make.
 */
export function InsuranceSolutions() {
  return (
    <section
      aria-labelledby="solutions-heading"
      className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="max-w-2xl">
        <p className="text-brand text-xs font-bold tracking-[0.2em] uppercase">What we insure</p>
        <h2
          id="solutions-heading"
          className="text-brand-strong mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl"
        >
          Insurance solutions
        </h2>
        <p className="text-content-muted mt-3 text-base leading-relaxed sm:text-lg">
          Cover for one person, a family or a whole workforce, compared for you in a minute — and
          the line we are adding next.
        </p>
      </div>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SOLUTIONS.map(({ title, icon: Icon, photo, focus, detail, action, comingSoon }) => (
          <li key={title}>
            <article className="group bg-brand-strong relative isolate h-[26rem] overflow-hidden rounded-(--radius-card) shadow-(--shadow-card) transition-shadow duration-500 focus-within:shadow-(--shadow-raised) hover:shadow-(--shadow-raised)">
              {/* The photograph, which rises to make room. */}
              <div className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:-translate-y-28 group-hover:-translate-y-28 [@media(hover:none)]:-translate-y-28">
                <Photo src={photo} className={cn('size-full object-cover', focus)} loading="lazy" />
                <div className="from-brand-strong/85 absolute inset-0 bg-linear-to-t via-transparent to-transparent" />
              </div>

              {comingSoon ? (
                <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[0.65rem] font-bold tracking-[0.18em] text-white uppercase shadow-[0_0_24px_-4px_var(--color-accent)] backdrop-blur-md">
                  <span aria-hidden className="bg-accent size-1.5 rounded-full" />
                  Coming soon
                </span>
              ) : null}

              {/* What lies beneath: the name always, the rest on reveal. */}
              <div className="absolute inset-x-0 bottom-0 flex translate-y-[calc(100%-4rem)] flex-col p-5 text-white transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:translate-y-0 group-hover:translate-y-0 [@media(hover:none)]:translate-y-0">
                <div className="flex h-11 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md">
                    <Icon className="size-4" />
                  </span>
                  <h3 className="text-lg font-bold">{title}</h3>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/80">{detail}</p>
                <Link
                  to={action.to}
                  className="text-accent mt-4 inline-flex items-center gap-1 text-sm font-bold hover:underline"
                >
                  {action.label}
                  <IconChevronRight className="size-4" />
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
