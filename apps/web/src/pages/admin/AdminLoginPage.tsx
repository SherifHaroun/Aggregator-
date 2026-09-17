import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Callout, Card, Field, Input, describeError } from '@/components/ui';
import { HadbrokLogo } from '@/components/ui/HadbrokLogo';
import { ROUTES } from '@/config/routes';
import { useSession, useSignIn } from '@/features/auth/auth.api';

/**
 * THE BROKER'S DOOR.
 *
 * The only sign-in there is. The employee gives the account's email and
 * password and is sent on to the page they were reaching for, or the
 * dashboard. Nothing here is for customers: the customer site has no
 * accounts, and a visitor who lands here has followed the wrong link.
 */
export function AdminLoginPage() {
  const [params] = useSearchParams();
  const next = params.get('next') ?? '';
  const target = next.startsWith(ROUTES.dashboard) ? next : ROUTES.dashboard;
  const session = useSession();
  const signIn = useSignIn();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  /* Already in: straight on. */
  if (session.data?.kind === 'admin') return <Navigate to={target} replace />;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    signIn.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => navigate(target, { replace: true }),
        onError: (failure) => setError(describeError(failure, 'logging in')),
      },
    );
  }

  return (
    <div className="bg-brand-gradient min-h-dvh px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center text-white">
          <HadbrokLogo variant="wide" className="mx-auto h-14 w-auto rounded-md" title="Hadbrok" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm text-white/80">
            Log in to the Hadbrok admin to manage plans, customers and offers.
          </p>
        </div>

        <Card className="p-6 shadow-(--shadow-raised) sm:p-8">
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
                  placeholder="you@hadbrok.com"
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
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-white/70">
          Hadbrok staff only. Customers compare plans on the Hadbrok website — no account needed.
        </p>
      </div>
    </div>
  );
}
