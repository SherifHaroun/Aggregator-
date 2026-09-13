import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useSession, useSessionToken } from './auth.api';

/** Where to come back to after signing in: the page that was asked for. */
export function loginUrl(next: string, options: { staff?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (next && next !== ROUTES.home) params.set('next', next);
  if (options.staff) params.set('staff', '1');
  const query = params.toString();
  return `${ROUTES.public.login}${query ? `?${query}` : ''}`;
}

function Checking() {
  return (
    <div className="text-content-subtle flex min-h-[40vh] items-center justify-center text-sm">
      Checking who you are…
    </div>
  );
}

/**
 * The gate, shared by both areas.
 *
 * A token whose check FAILED for a reason other than the token — the API
 * not answering during its boot window, say — lets the page through: the
 * token was good last time, the page shows its own error and retry, and
 * the API refuses anything it should. A token the API rejected has already
 * been dropped by `useSession`, so that case arrives here as no token at all.
 */
function useGate(kind: 'admin' | 'customer') {
  const token = useSessionToken();
  const session = useSession();
  if (!token) return 'refuse' as const;
  if (session.isPending) return 'checking' as const;
  if (session.isError) return 'allow' as const;
  return session.data?.kind === kind ? ('allow' as const) : ('refuse' as const);
}

/** The employee area: staff only. Anybody else is sent to sign in as staff. */
export function RequireAdmin() {
  const gate = useGate('admin');
  const location = useLocation();
  if (gate === 'checking') return <Checking />;
  if (gate === 'allow') return <Outlet />;
  return <Navigate to={loginUrl(location.pathname + location.search, { staff: true })} replace />;
}

/** A plan in full, or a cart: the customer's own, so a customer must be signed in. */
export function RequireCustomer() {
  const gate = useGate('customer');
  const location = useLocation();
  if (gate === 'checking') return <Checking />;
  if (gate === 'allow') return <Outlet />;
  return <Navigate to={loginUrl(location.pathname + location.search)} replace />;
}
