/**
 * API contracts for CUSTOMERS and the comparisons kept for them.
 *
 * A customer is somebody who rang or wrote in. The employee runs comparisons
 * on their behalf and keeps the ones worth discussing in the customer's CART
 * — a working list, not a sale — until the customer settles on one, which is
 * then marked as their choice.
 *
 * Nothing here is insurance data: a customer is a person the broker is
 * talking to, and a cart item points at a plan without copying its cover.
 */

import type { CustomerTypeId } from '../config/customer-types.js';
import type { ComparisonRequestInput } from './comparison-results.js';

export interface CustomerDto {
  id: string;
  name: string;
  /** Optional: a caller may leave no number. */
  phone: string | null;
  /** Optional: a caller may leave no address. */
  email: string | null;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
  /** How many comparisons are in the cart. */
  cartCount: number;
  /** The cart item the customer chose, once they have. */
  chosenItemId: string | null;
}

/**
 * One comparison kept for a customer: the plan it was saved with, and the
 * selection it was run from so the results open again exactly as they were.
 */
export interface CustomerCartItemDto {
  id: string;
  customerId: string;
  /** "Arope SME 1" — the company, the section, and the count of that pairing. */
  name: string;
  /** What the employee wrote under the name, shown when the cart is opened. */
  note: string | null;
  /** `null` once the plan has been deleted; the snapshot below still reads. */
  planConfigurationId: string | null;
  planId: string | null;
  companyId: string | null;
  companyName: string;
  planName: string;
  customerTypeId: CustomerTypeId;
  /** What this customer would pay per year, as the comparison worked it out. */
  annualPrice: number | null;
  currency: string | null;
  /** The selection the comparison was run from. */
  criteria: ComparisonRequestInput;
  /** Whether the customer settled on this one. */
  isChosen: boolean;
  /** ISO 8601, when they did. */
  chosenAt: string | null;
  /** ISO 8601. The cart lists items in this order, first to last. */
  createdAt: string;
}

/** A customer read with their cart. */
export interface CustomerWithCartDto extends CustomerDto {
  items: CustomerCartItemDto[];
}

/**
 * What the cart button shows: every customer with something in their cart,
 * and how many comparisons there are in all.
 */
export interface CartSummaryDto {
  totalItems: number;
  customers: CustomerWithCartDto[];
}

/** What is sent to keep a comparison for a customer. */
export interface AddCartItemInput {
  planConfigurationId: string;
  criteria: ComparisonRequestInput;
  note?: string | null;
}
