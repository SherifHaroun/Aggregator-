import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { param } from '../../lib/request.js';
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
 * Mounted behind the write gate like every other data resource: a customer
 * record is the broker's, and a public aggregator has no business reading
 * who rang in.
 */
export const customersRouter: Router = Router();

customersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(success(await listCustomers(listCustomersQuerySchema.parse(req.query))));
  }),
);

customersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(success(await createCustomer(createCustomerSchema.parse(req.body))));
  }),
);

/** Everything waiting in every cart. Declared before `/:id`. */
customersRouter.get(
  '/cart',
  asyncHandler(async (_req, res) => {
    res.json(success(await getCartSummary()));
  }),
);

customersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await getCustomer(param(req, 'id'))));
  }),
);

customersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await updateCustomer(param(req, 'id'), updateCustomerSchema.parse(req.body))));
  }),
);

customersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteCustomer(param(req, 'id'));
    res.status(204).send();
  }),
);

// --- the cart ------------------------------------------------------------------

customersRouter.post(
  '/:id/cart',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(success(await addCartItem(param(req, 'id'), addCartItemSchema.parse(req.body))));
  }),
);

customersRouter.patch(
  '/:id/cart/:itemId',
  asyncHandler(async (req, res) => {
    res.json(
      success(
        await updateCartItem(
          param(req, 'id'),
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
    await removeCartItem(param(req, 'id'), param(req, 'itemId'));
    res.status(204).send();
  }),
);
