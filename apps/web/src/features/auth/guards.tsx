import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useSession, useSessionToken } from './auth.api';

/** Where to come back to after signing in: the page that was asked for. */
export function loginUrl(next: string): string {
  const params = new URLSearchParams();
  if (next && next !== ROUTES.dashboard) params.set('next', next);
  const query = params.toString();
  return `${ROUTES.login}${query ? `?${query}` : ''}`;
}

function Checking() {
  return (
    <div className="text-content-subtle flex min-h-[40vh] items-center justify-center text-sm">
      Checking who you are…
    </div>
  );
}

/**
 * THE GATE ON THE EMPLOYEE AREA: staff only. Anybody else is sent to the door.
 *
 * A token whose check FAILED for a reason other than the token — the API
 * not answering during its boot window, say — lets the page through: the
 * token was good last time, the page shows its own error and retry, and
 * the API refuses anything it should. A token the API rejected has already
 * been dropped by `useSession`, so that case arrives here as no token at all.
 */
export function RequireAdmin() {
  const token = useSessionToken();
  const session = useSession();
  const location = useLocation();

  if (!token) return <Navigate to={loginUrl(location.pathname + location.search)} replace />;
  if (session.isPending) return <Checking />;
  if (session.isError || session.data?.kind === 'admin') return <Outlet />;
  return <Navigate to={loginUrl(location.pathname + location.search)} replace />;
}
