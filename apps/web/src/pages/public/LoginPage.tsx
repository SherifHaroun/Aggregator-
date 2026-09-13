import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import type { LoginResultDto } from '@aggregator/shared';
import { Button, Callout, Card, Field, Input, describeError } from '@/components/ui';
import { HadbrokLogo } from '@/components/ui/HadbrokLogo';
import { ROUTES } from '@/config/routes';
import { useSession, useSignIn, useSignOut, useSignUp } from '@/features/auth/auth.api';
import { cn } from '@/lib/cn';

/**
 * ONE DOOR.
 *
 * Everybody signs in with an email and a password; the server says who
 * they turned out to be, and they are sent to the page they were reaching
 * for — the employee area if the account is the broker's, the customer site
 * otherwise. A newcomer flips to "Sign up" and gives their name, email, a
 * password and the company they buy for.
 */
type Mode = 'login' | 'signup';

export function LoginPage() {
  const [params] = useSearchParams();
  const next = params.get('next') ?? '';
  const wantsAdmin = next.startsWith(ROUTES.dashboard);
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const session = useSession();
  const signOut = useSignOut();
  const navigate = useNavigate();

  /* Already in: straight on, unless they are the wrong kind for the page. */
  if (session.data?.kind === 'customer' && !wantsAdmin) {
    return <Navigate to={next && next.startsWith('/') ? next : ROUTES.home} replace />;
  }
  if (session.data?.kind === 'admin' && (wantsAdmin || !next)) {
    return <Navigate to={wantsAdmin ? next : ROUTES.dashboard} replace />;
  }

  function arrived(result: LoginResultDto) {
    const target =
      result.session.kind === 'admin'
        ? wantsAdmin
          ? next
          : ROUTES.dashboard
        : next && next.startsWith('/') && !wantsAdmin
          ? next
          : ROUTES.home;
    navigate(target, { replace: true });
  }

  return (
    <div className="bg-brand-gradient min-h-[calc(100dvh-4rem)] px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center text-white">
          <HadbrokLogo variant="wide" className="mx-auto h-14 w-auto rounded-md" title="Hadbrok" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-white/80">
            {mode === 'login'
              ? 'Log in to open a plan in full and keep the ones you like.'
              : 'It takes a moment, and we keep the plans you like for you.'}
          </p>
        </div>

        <Card className="p-6 shadow-(--shadow-raised) sm:p-8">
          <div
            role="tablist"
            aria-label="Log in or sign up"
            className="bg-surface-muted mb-6 grid grid-cols-2 gap-1 rounded-(--radius-control) p-1"
          >
            {(
              [
                ['login', 'Log in'],
                ['signup', 'Sign up'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={cn(
                  'rounded-[calc(var(--radius-control)-2px)] px-3 py-2 text-sm font-semibold transition-colors',
                  mode === id
                    ? 'bg-surface text-brand-strong shadow-(--shadow-card)'
                    : 'text-content-muted hover:text-content',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {session.data?.kind === 'admin' ? (
            <Callout tone="warning" title="You are signed in as staff">
              That page is for customers. Sign out to continue as one, or go to the admin area.
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={signOut}>
                  Sign out
                </Button>
                <Button size="sm" onClick={() => navigate(ROUTES.dashboard)}>
                  Admin area
                </Button>
              </div>
            </Callout>
          ) : session.data?.kind === 'customer' ? (
            <Callout tone="warning" title={`You are signed in as ${session.data.customer.name}`}>
              The admin area is for Hadbrok staff. Sign out first to enter it.
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </Callout>
          ) : mode === 'login' ? (
            <LoginForm onDone={arrived} onSwitch={() => setMode('signup')} />
          ) : (
            <SignUpForm onDone={arrived} onSwitch={() => setMode('login')} />
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

function LoginForm({
  onDone,
  onSwitch,
}: {
  onDone: (result: LoginResultDto) => void;
  onSwitch: () => void;
}) {
  const signIn = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    signIn.mutate(
      { email: email.trim(), password },
      { onSuccess: onDone, onError: (failure) => setError(describeError(failure, 'logging in')) },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error ? (
        <Callout tone="danger" title="Could not log you in">
          {error}
        </Callout>
      ) : null}
      <Field label="Email" required>
        {(props) => (
          <Input
            {...props}
            autoFocus
            type="email"
            autoComplete="username"
            value={email}
            placeholder="you@example.com"
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
        {signIn.isPending ? 'Logging in…' : 'Log in'}
      </Button>
      <p className="text-content-subtle text-center text-xs">
        New to Hadbrok?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="text-brand font-semibold hover:underline"
        >
          Create an account
        </button>
      </p>
    </form>
  );
}

function SignUpForm({
  onDone,
  onSwitch,
}: {
  onDone: (result: LoginResultDto) => void;
  onSwitch: () => void;
}) {
  const signUp = useSignUp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Enter your name, email and a password.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.');
      return;
    }
    signUp.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        password,
        companyName: companyName.trim() || null,
      },
      {
        onSuccess: onDone,
        onError: (failure) => setError(describeError(failure, 'creating your account')),
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error ? (
        <Callout tone="danger" title="Could not create your account">
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
      <Field label="Password" required hint="At least 8 characters.">
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>
      <Field label="Company name" hint="If you are buying for a business. Leave empty otherwise.">
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
      <Button type="submit" size="lg" fullWidth disabled={signUp.isPending}>
        {signUp.isPending ? 'Creating your account…' : 'Create account'}
      </Button>
      <p className="text-content-subtle text-center text-xs">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="text-brand font-semibold hover:underline"
        >
          Log in
        </button>
      </p>
    </form>
  );
}
