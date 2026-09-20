import { formatMoney } from '@aggregator/shared';
import { Link, useSearchParams } from 'react-router-dom';
import { ButtonLink, IconCheck, IconChevronRight, IconShield } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { leadIdOf, withoutLead } from '@/features/leads/lead-session';
import { useLead } from '@/features/leads/leads.api';
import { LocationChip } from '@/features/public/LocationChip';
import { ADDRESS, HOURS, PHONE_MOBILE, tel } from '@/pages/public/CompanyPages';

/**
 * THE VISITOR CHOSE. The PDF is in their inbox and a Hadbrok adviser will
 * call within a day — said plainly, in the site's own frame, with the plan
 * they chose named so there is no doubt which one the call is about.
 *
 * If the email could not be sent, the page says so rather than promising
 * it: the adviser will bring the plan on the call.
 */
export function ChosenPage() {
  const [params] = useSearchParams();
  const leadId = leadIdOf(params);
  const lead = useLead(leadId);
  const choice = lead.data?.choice ?? null;
  const emailSent = choice?.emailStatus === 'SENT';
  /* The API answers before the email goes; the lead is polled until it settles. */
  const emailPending = !lead.data || !choice || choice.emailStatus === 'PENDING';
  const backToResults = `${ROUTES.public.results}?${params.toString()}`;

  return (
    <div className="bg-brand-gradient relative overflow-hidden text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-[28rem] rounded-full bg-white/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 size-[22rem] rounded-full bg-white/5"
      />
      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28">
        <span className="bg-accent text-brand-strong flex size-20 items-center justify-center rounded-full shadow-(--shadow-raised)">
          <IconCheck className="size-10" strokeWidth={2.5} />
        </span>
        <p className="text-accent mt-8 text-xs font-bold tracking-[0.2em] uppercase">
          Step 3 of 3 · Done
        </p>
        <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
          {emailSent || emailPending ? 'Your plan is on its way.' : 'Your plan is chosen.'}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
          {emailSent
            ? 'The plan PDF has been sent to your email, and one of our team will contact you within 24 hours.'
            : emailPending
              ? 'We are sending the plan PDF to your email now, and one of our team will contact you within 24 hours.'
              : 'We could not send the PDF to your email just now, so one of our team will bring the full plan when they contact you within 24 hours.'}
        </p>

        {choice ? (
          <div className="mt-10 w-full max-w-md rounded-(--radius-card) border border-white/15 bg-white/10 p-5 text-left backdrop-blur-md">
            <p className="text-xs font-bold tracking-widest text-white/70 uppercase">
              The plan you chose
            </p>
            <p className="mt-2 text-xl font-bold">
              {choice.companyName} · {choice.planName}
            </p>
            <p className="text-sm text-white/80">
              {formatMoney(choice.annualPrice, choice.currency)}
              {choice.annualPrice !== null ? ' per year' : ''}
              {lead.data?.email
                ? ` · ${emailSent ? 'sent to' : emailPending ? 'sending to' : 'for'} ${lead.data.email}`
                : ''}
            </p>
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href={tel(PHONE_MOBILE)}
            className="bg-accent text-brand-strong inline-flex h-12 items-center gap-2 rounded-(--radius-control) px-6 text-sm font-bold shadow-(--shadow-card) transition-transform hover:scale-[1.02]"
          >
            <IconShield className="size-4" />
            Or call us now · {PHONE_MOBILE}
          </a>
          {leadId ? (
            <ButtonLink
              to={backToResults}
              variant="secondary"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              Back to my results
              <IconChevronRight className="size-4" />
            </ButtonLink>
          ) : null}
        </div>
        <p className="mt-6 text-xs text-white/60">{HOURS}</p>
        <div className="mt-4 flex justify-center">
          <LocationChip address={ADDRESS} />
        </div>

        <p className="mt-10 text-sm text-white/70">
          Want to compare something else?{' '}
          <Link
            to={`${ROUTES.home}?${withoutLead(params).toString()}#compare`}
            className="font-semibold text-white hover:underline"
          >
            Start a new comparison
          </Link>
        </p>
      </div>
    </div>
  );
}
