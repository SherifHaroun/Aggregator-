import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Callout, Card, Field, Input, describeError } from '@/components/ui';
import { HadbrokLogo } from '@/components/ui/HadbrokLogo';
import { ROUTES } from '@/config/routes';
import {
  useAdminSignIn,
  useCustomerSignIn,
  useSession,
  useSignOut,
} from '@/features/auth/auth.api';
import { cn } from '@/lib/cn';

/**
 * ONE DOOR.
 *
 * A customer gives their name, email and phone number and is in — the same
 * form signs up and signs in, because to a caller they are one thing. An
 * employee flips to the staff tab and enters the broker's email and
 * password. Whoever it was is sent to the page they were reaching for.
 */
export function LoginPage() {
  const [params] = useSearchParams();
  const next = params.get('next') ?? '';
  const [staff, setStaff] = useState(params.get('staff') === '1');
  const session = useSession();
  const signOut = useSignOut();

  /* Already in: straight on, unless they are the wrong kind for the page. */
  if (session.data?.kind === 'customer' && !staff) {
    return <Navigate to={next && next.startsWith('/') ? next : ROUTES.home} replace />;
  }
  if (session.data?.kind === 'admin' && staff) {
    return (
      <Navigate to={next && next.startsWith(ROUTES.dashboard) ? next : ROUTES.dashboard} replace />
    );
  }

  return (
    <div className="bg-brand-gradient min-h-[calc(100dvh-4rem)] px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center text-white">
          <HadbrokLogo variant="wide" className="mx-auto h-14 w-auto rounded-md" title="Hadbrok" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
            {staff ? 'Employee sign in' : 'Welcome to Hadbrok'}
          </h1>
          <p className="mt-2 text-sm text-white/80">
            {staff
              ? 'The admin area is for Hadbrok staff.'
              : 'Tell us who you are and we will keep the plans you like for you.'}
          </p>
        </div>

        <Card className="p-6 shadow-(--shadow-raised) sm:p-8">
          <div
            role="tablist"
            aria-label="Who is signing in"
            className="bg-surface-muted mb-6 grid grid-cols-2 gap-1 rounded-(--radius-control) p-1"
          >
            {(
              [
                ['customer', 'Customer'],
                ['staff', 'Employee'],
              ] as const
            ).map(([id, label]) => {
              const active = staff === (id === 'staff');
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStaff(id === 'staff')}
                  className={cn(
                    'rounded-[calc(var(--radius-control)-2px)] px-3 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-surface text-brand-strong shadow-(--shadow-card)'
                      : 'text-content-muted hover:text-content',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {session.data?.kind === 'admin' && !staff ? (
            <Callout tone="warning" title="You are signed in as staff">
              Sign out to continue as a customer.
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </Callout>
          ) : session.data?.kind === 'customer' && staff ? (
            <Callout tone="warning" title={`You are signed in as ${session.data.customer.name}`}>
              Sign out first to enter the admin area.
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </Callout>
          ) : staff ? (
            <StaffForm next={next} />
          ) : (
            <CustomerForm next={next} />
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-white/70">
          <Link to={ROUTES.home} className="hover:text-white hover:underline">
            Back to the home page
          </Link>
        </p>
      </div>
    </div>
  );
}

function CustomerForm({ next }: { next: string }) {
  const signIn = useCustomerSignIn();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError('Please fill in your name, email and phone number.');
      return;
    }
    signIn.mutate(
      { name: name.trim(), email: email.trim(), phone: phone.trim() },
      {
        onSuccess: () =>
          navigate(next && next.startsWith('/') ? next : ROUTES.home, { replace: true }),
        onError: (failure) => setError(describeError(failure, 'signing in')),
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error ? (
        <Callout tone="danger" title="Could not sign you in">
          {error}
        </Callout>
      ) : null}
      <Field label="Full name" required>
        {(props) => (
          <Input
            {...props}
            autoFocus
            autoComplete="name"
            value={name}
            placeholder="e.g. Mona Adel"
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>
      <Field label="Email" required>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="email"
            value={email}
            placeholder="you@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>
      <Field label="Phone number" required hint="We call this number about the plans you keep.">
        {(props) => (
          <Input
            {...props}
            type="tel"
            autoComplete="tel"
            value={phone}
            placeholder="e.g. 0100 123 4567"
            onChange={(event) => setPhone(event.target.value)}
          />
        )}
      </Field>
      <Button type="submit" size="lg" fullWidth disabled={signIn.isPending}>
        {signIn.isPending ? 'Signing in…' : 'Continue'}
      </Button>
      <p className="text-content-subtle text-center text-xs">
        No password needed. If we already know you, we will pick up where you left off.
      </p>
    </form>
  );
}

function StaffForm({ next }: { next: string }) {
  const signIn = useAdminSignIn();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    signIn.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () =>
          navigate(next && next.startsWith(ROUTES.dashboard) ? next : ROUTES.dashboard, {
            replace: true,
          }),
        onError: (failure) => setError(describeError(failure, 'signing in')),
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error ? (
        <Callout tone="danger" title="Could not sign you in">
          {error}
        </Callout>
      ) : null}
      <Field label="Work email" required>
        {(props) => (
          <Input
            {...props}
            autoFocus
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>
      <Field label="Password" required>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>
      <Button type="submit" size="lg" fullWidth disabled={signIn.isPending}>
        {signIn.isPending ? 'Signing in…' : 'Sign in to the admin area'}
      </Button>
    </form>
  );
}
