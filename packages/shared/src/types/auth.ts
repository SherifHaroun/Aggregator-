/**
 * API contracts for SIGNING IN — the employee area only.
 *
 * The customer site has no accounts: a visitor compares, leaves their details
 * as a LEAD (`types/leads.ts`) and is called back. The only door is the
 * broker's own, at the admin site: an email and a password configured on
 * the server, never in the database, and the session that comes back is
 * the employee's.
 */

export interface LoginInput {
  email: string;
  password: string;
}

export interface SessionDto {
  kind: 'admin';
  email: string;
}

/** What a successful sign-in hands back: the token to send, and who it is. */
export interface LoginResultDto {
  token: string;
  session: SessionDto;
}
