import { customerTypeLabel, formatNumber, totalSmeEmployees } from '@aggregator/shared';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  ButtonLink,
  Callout,
  Field,
  IconCheck,
  IconChevronRight,
  IconLock,
  IconShield,
  Input,
  describeError,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { parseComparisonRequest } from '@/features/comparison';
import { recallLead, withLead } from '@/features/leads/lead-session';
import { useCreateLead } from '@/features/leads/leads.api';

/**
 * ONE FINAL STEP BEFORE THE RESULTS.
 *
 * The visitor has said who to insure. Before the best plans are shown they
 * say who THEY are: first name, last name, mobile, email and company. That
 * is the whole price of the results — no account, no password — and it is
 * what turns a visit into a lead the broker can call.
 *
 * The comparison arrives in the query string exactly as it would reach the
 * results, and leaves for the results with the lead beside it. A visitor
 * who has already given their details this session finds them filled in.
 */
export function LeadDetailsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const request = useMemo(() => parseComparisonRequest(params), [params]);
  const remembered = useMemo(() => recallLead(), []);
  const createLead = useCreateLead();

  const [firstName, setFirstName] = useState(remembered?.details.firstName ?? '');
  const [lastName, setLastName] = useState(remembered?.details.lastName ?? '');
  const [phone, setPhone] = useState(remembered?.details.phone ?? '');
  const [email, setEmail] = useState(remembered?.details.email ?? '');
  const [companyName, setCompanyName] = useState(remembered?.details.companyName ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (request === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <p className="text-content-muted">This link is missing the comparison details.</p>
        <ButtonLink to={`${ROUTES.home}#compare`} className="mt-4">
          Compare plans
        </ButtonLink>
      </div>
    );
  }

  const errors = {
    firstName: firstName.trim() ? null : 'Enter your first name.',
    lastName: lastName.trim() ? null : 'Enter your last name.',
    phone: /^[+\d][\d\s()-]{5,}$/.test(phone.trim()) ? null : 'Enter your mobile number.',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Enter a valid email address.',
  };
  const invalid = Object.values(errors).some((error) => error !== null);

  const employees = request.smeEmployees ? totalSmeEmployees(request.smeEmployees) : 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (invalid || request === null) {
      setShowErrors(true);
      return;
    }
    createLead.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        companyName: companyName.trim() || null,
        criteria: request,
      },
      {
        onSuccess: (lead) =>
          navigate(`${ROUTES.public.results}?${withLead(params, lead.id).toString()}`),
        onError: (error) => setFailure(describeError(error, 'your details')),
      },
    );
  }

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
      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:px-8 lg:py-20">
        <div>
          <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">One final step</p>
          <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
            Your best plans
            <br />
            are ready.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/80 sm:text-lg">
            We have compared every {customerTypeLabel(request.customerTypeId)} plan from every
            insurer we work with
            {employees > 0
              ? ` for your ${formatNumber(employees)} ${employees === 1 ? 'employee' : 'employees'}`
              : ''}
            . Tell us who to send them to and they are yours — the best three in every tier, with
            the full details as a PDF.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/85">
            {[
              'See the best three plans in each tier, side by side.',
              'Open any plan in full and get its PDF in your inbox.',
              'Choose one and a Hadbrok adviser calls you within 24 hours.',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="bg-accent text-brand-strong mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                  <IconCheck className="size-3" strokeWidth={2.5} />
                </span>
                {line}
              </li>
            ))}
          </ul>

          <p className="mt-8 inline-flex items-center gap-2 text-xs text-white/60">
            <IconLock className="size-4" />
            No account, no password. Your details go to Hadbrok only.
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="bg-surface text-content rounded-(--radius-card) p-5 shadow-(--shadow-raised) sm:p-7"
        >
          <div className="flex items-center gap-3">
            <span className="bg-brand text-content-inverted rounded-(--radius-pill) px-3 py-1 text-xs font-bold">
              2 / 3
            </span>
            <span className="text-content text-sm font-medium">
              Who should we send the results to?
            </span>
          </div>
          <div className="bg-surface-muted mt-3 h-1.5 overflow-hidden rounded-full">
            <div className="bg-brand h-full w-2/3 rounded-full" />
          </div>

          {failure ? (
            <div className="mt-5">
              <Callout tone="danger" title="Could not save your details">
                {failure}
              </Callout>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label="First name"
              required
              error={showErrors ? (errors.firstName ?? undefined) : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  autoFocus
                  autoComplete="given-name"
                  value={firstName}
                  placeholder="Mona"
                  onChange={(event) => setFirstName(event.target.value)}
                />
              )}
            </Field>
            <Field
              label="Last name"
              required
              error={showErrors ? (errors.lastName ?? undefined) : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  autoComplete="family-name"
                  value={lastName}
                  placeholder="Adel"
                  onChange={(event) => setLastName(event.target.value)}
                />
              )}
            </Field>
            <Field
              label="Mobile number"
              required
              error={showErrors ? (errors.phone ?? undefined) : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  placeholder="+20 10 0000 0000"
                  onChange={(event) => setPhone(event.target.value)}
                />
              )}
            </Field>
            <Field
              label="Email"
              required
              error={showErrors ? (errors.email ?? undefined) : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  autoComplete="email"
                  value={email}
                  placeholder="you@company.com"
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <Field label="Company" hint="The business the cover is for.">
                {(props) => (
                  <Input
                    {...props}
                    autoComplete="organization"
                    value={companyName}
                    placeholder="e.g. Nile Trading Co."
                    onChange={(event) => setCompanyName(event.target.value)}
                  />
                )}
              </Field>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            fullWidth
            className="mt-7 tracking-wide uppercase"
            disabled={createLead.isPending}
          >
            {createLead.isPending ? 'One moment…' : 'Show my results'}
            <IconChevronRight className="size-4" />
          </Button>
          <p className="text-content-subtle mt-3 flex items-center justify-center gap-2 text-center text-xs">
            <IconShield className="size-4" />
            Instant quotes. A Hadbrok adviser follows up personally.
          </p>
          <p className="mt-3 text-center text-xs">
            <Link
              to={`${ROUTES.home}#compare`}
              className="text-brand font-semibold hover:underline"
            >
              Change what you are comparing
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
