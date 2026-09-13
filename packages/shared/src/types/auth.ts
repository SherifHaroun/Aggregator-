/**
 * API contracts for SIGNING IN.
 *
 * ONE DOOR. Everybody signs in the same way — an email and a password — and
 * the server says who they turned out to be. The broker's own account
 * (configured on the server, never in the database) comes back as `admin`
 * and reaches the employee area; anybody else is a customer, whose record
 * is the same one the employees see in the admin's Customers page, so what
 * they keep in their cart is what the broker calls them about.
 *
 * A customer without an account SIGNS UP first: their name, email, a
 * password of their choosing, and the company they buy for if any.
 */

import type { CustomerDto } from './customers.js';

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  companyName?: string | null;
}

export type SessionDto =
  { kind: 'admin'; email: string } | { kind: 'customer'; customer: CustomerDto };

/** What a successful sign-in hands back: the token to send, and who it is. */
export interface LoginResultDto {
  token: string;
  session: SessionDto;
}
