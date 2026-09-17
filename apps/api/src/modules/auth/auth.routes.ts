import { Router } from 'express';
import { HttpError, success } from '../../lib/api-response.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { loginSchema } from './auth.schemas.js';
import { signIn } from './auth.service.js';

/**
 * Sign in, and ask who is signed in. Mounted before every gate: signing in
 * is how a caller becomes somebody the gates let through. The broker's
 * account is the only one — the customer site has no sign-in at all.
 */
export const authRouter: Router = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    res.json(success(await signIn(loginSchema.parse(req.body))));
  }),
);

/** Who the token belongs to — the admin client asks on every page load. */
authRouter.get(
  '/session',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Not signed in.');
    res.json(success({ kind: 'admin', email: auth.email }));
  }),
);
