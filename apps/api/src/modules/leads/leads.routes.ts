import { Router, type Request } from 'express';
import { HttpError, success } from '../../lib/api-response.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createLeadSchema, leadPlanSchema } from './leads.schemas.js';
import { choosePlan, createLead, getLead, recordPlanView } from './leads.service.js';

/**
 * THE CUSTOMER SITE'S ONLY WRITES. Nobody is signed in there, so nothing
 * here asks for a token: a visitor leaves their details, opens a plan,
 * chooses one. What they may reach afterwards is exactly the lead they
 * made, by its id — a long random one that is not guessable and that only
 * their own browser was handed.
 *
 * Mounted in front of the write gate, and rate-limited per address so a
 * script cannot fill the broker's bell with noise.
 */
export const leadsRouter: Router = Router();

/**
 * A small in-memory limiter: so many writes per address per window. Enough
 * for any real visitor several times over; a wall for a loop. Per process,
 * which is what a single Railway service is.
 */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 40;
const hits = new Map<string, { count: number; resetAt: number }>();

function throttle(req: Request): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 10_000) {
      for (const [address, value] of hits) if (value.resetAt <= now) hits.delete(address);
    }
    return;
  }
  entry.count += 1;
  if (entry.count > LIMIT) {
    throw new HttpError(429, 'TOO_MANY_REQUESTS', 'Too many requests. Please try again shortly.');
  }
}

leadsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    throttle(req);
    res.status(201).json(success(await createLead(createLeadSchema.parse(req.body))));
  }),
);

leadsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await getLead(param(req, 'id'))));
  }),
);

/** The visitor opened a plan in full: noted, and the PDF sent to them. */
leadsRouter.post(
  '/:id/views',
  asyncHandler(async (req, res) => {
    throttle(req);
    res.json(success(await recordPlanView(param(req, 'id'), leadPlanSchema.parse(req.body))));
  }),
);

/** The visitor chose a plan: into their cart, PDF sent, the broker will call. */
leadsRouter.post(
  '/:id/choice',
  asyncHandler(async (req, res) => {
    throttle(req);
    res.json(success(await choosePlan(param(req, 'id'), leadPlanSchema.parse(req.body))));
  }),
);
