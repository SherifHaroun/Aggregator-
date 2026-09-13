import { Router, type Request } from 'express';
import { HttpError, success } from '../../lib/api-response.js';
import { param } from '../../lib/request.js';
import { isAdmin, requireAdmin } from '../../middleware/access.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  addCartItemSchema,
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCartItemSchema,
  updateCustomerSchema,
} from './customers.schemas.js';
import {
  addCartItem,
  createCustomer,
  deleteCustomer,
  getCartSummary,
  getCustomer,
  listCustomers,
  removeCartItem,
  updateCartItem,
  updateCustomer,
} from './customers.service.js';

/**
 * Customers and their carts.
 *
 * WHO MAY SEE WHOM. An employee sees everyone. A customer who signed in on
 * the website sees exactly one record — their own, addressed as `me` — and
 * may keep plans in, and remove them from, that one cart. Nobody else sees
 * anything: a customer record is the broker's, and the public site has no
 * business reading who rang in.
 */
export const customersRouter: Router = Router();

const ME = 'me';

/** The customer a route is about: the signed-in one for `me`, else the id given. */
function customerIdOf(req: Request): string {
  const id = param(req, 'id');
  if (id !== ME) return id;
  if (req.auth?.kind !== 'customer') {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to see your cart.');
  }
  return req.auth.customerId;
}

/**
 * The rule, applied once for every `/:id` route: `me` needs a signed-in
 * customer, anything else needs an employee.
 */
customersRouter.param('id', (req, _res, next, id: string) => {
  if (id === ME) {
    if (req.auth?.kind === 'customer') return next();
    return next(new HttpError(401, 'UNAUTHENTICATED', 'Sign in to see your cart.'));
  }
  if (isAdmin(req)) return next();
  next(
    req.auth
      ? new HttpError(403, 'FORBIDDEN', 'Only Hadbrok staff can see other customers.')
      : new HttpError(401, 'UNAUTHENTICATED', 'Sign in as Hadbrok staff to continue.'),
  );
});

customersRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(success(await listCustomers(listCustomersQuerySchema.parse(req.query))));
  }),
);

customersRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.status(201).json(success(await createCustomer(createCustomerSchema.parse(req.body))));
  }),
);

/** Everything waiting in every cart. Declared before `/:id`. */
customersRouter.get(
  '/cart',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(success(await getCartSummary()));
  }),
);

customersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await getCustomer(customerIdOf(req))));
  }),
);

customersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(
      success(await updateCustomer(customerIdOf(req), updateCustomerSchema.parse(req.body))),
    );
  }),
);

/** Deleting a customer is the broker's call, never the customer's own. */
customersRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteCustomer(customerIdOf(req));
    res.status(204).send();
  }),
);

// --- the cart ------------------------------------------------------------------

customersRouter.post(
  '/:id/cart',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(success(await addCartItem(customerIdOf(req), addCartItemSchema.parse(req.body))));
  }),
);

customersRouter.patch(
  '/:id/cart/:itemId',
  asyncHandler(async (req, res) => {
    res.json(
      success(
        await updateCartItem(
          customerIdOf(req),
          param(req, 'itemId'),
          updateCartItemSchema.parse(req.body),
        ),
      ),
    );
  }),
);

customersRouter.delete(
  '/:id/cart/:itemId',
  asyncHandler(async (req, res) => {
    await removeCartItem(customerIdOf(req), param(req, 'itemId'));
    res.status(204).send();
  }),
);
