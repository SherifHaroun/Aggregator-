import { ROUTES } from '@/config/routes';
import type { FakeStore } from './fake-api';

/**
 * EVERY COMPARISON IS RUN FOR SOMEBODY. The form will not compare until a
 * customer is chosen, so the tests that are about the cover rather than the
 * caller start with one already picked — the way the employee arrives from a
 * customer's page, with the customer in the URL.
 */
export function givenAnyCustomer(store: FakeStore, id = 'customer_test', name = 'Test Caller') {
  const stamp = new Date(0).toISOString();
  store.customers.push({ id, name, phone: null, email: null, createdAt: stamp, updatedAt: stamp });
  return id;
}

export function newComparisonFor(customerId: string): string {
  return `${ROUTES.comparison.new}?customerId=${customerId}`;
}
