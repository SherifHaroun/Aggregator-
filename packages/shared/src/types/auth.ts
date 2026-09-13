/**
 * API contracts for SIGNING IN.
 *
 * Two kinds of people use the site. An EMPLOYEE signs in with the broker's
 * email and password and reaches the admin area. A CUSTOMER signs in with
 * their name, email and phone number — no password: the site is a shop
 * window, and a caller who has to invent a password to read a plan walks
 * away. The customer record that creates is the same one the employees see
 * in the admin's Customers page, so what a customer keeps in their cart is
 * what the broker calls them about.
 */

import type { CustomerDto } from './customers.js';

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface CustomerLoginInput {
  name: string;
  email: string;
  phone: string;
}

export type SessionDto =
  { kind: 'admin'; email: string } | { kind: 'customer'; customer: CustomerDto };

/** What a successful sign-in hands back: the token to send, and who it is. */
export interface LoginResultDto {
  token: string;
  session: SessionDto;
}
