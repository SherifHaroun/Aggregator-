import { ROUTES } from '@/config/routes';

/** The query parameter that names the customer the offers page should open on. */
export const OFFER_CUSTOMER_PARAM = 'customer';

/** The offers page, scrolled to one customer. */
export function offerUrl(customerId: string): string {
  return `${ROUTES.offers.list}?${OFFER_CUSTOMER_PARAM}=${encodeURIComponent(customerId)}`;
}

/** The element id the offers page gives each customer's card. */
export function offerAnchor(customerId: string): string {
  return `offer-${customerId}`;
}
