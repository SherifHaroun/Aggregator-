import { Router } from 'express';
import { HttpError, success } from '../../lib/api-response.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getCustomer } from '../customers/customers.service.js';
import { adminLoginSchema, customerLoginSchema } from './auth.schemas.js';
import { signInAdmin, signInCustomer } from './auth.service.js';

/**
 * Sign in, and ask who is signed in. Mounted before every gate: signing in
 * is how a caller becomes somebody the gates let through.
 */
export const authRouter: Router = Router();

authRouter.post('/admin/login', (req, res) => {
  res.json(success(signInAdmin(adminLoginSchema.parse(req.body))));
});

authRouter.post(
  '/customer/login',
  asyncHandler(async (req, res) => {
    res.json(success(await signInCustomer(customerLoginSchema.parse(req.body))));
  }),
);

/** Who the token belongs to — the client asks on every page load. */
authRouter.get(
  '/session',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Not signed in.');
    if (auth.kind === 'admin') {
      res.json(success({ kind: 'admin', email: auth.email }));
      return;
    }
    res.json(success({ kind: 'customer', customer: await getCustomer(auth.customerId) }));
  }),
);
