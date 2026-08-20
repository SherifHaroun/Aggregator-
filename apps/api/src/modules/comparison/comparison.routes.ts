import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { comparisonPriceRangeSchema, comparisonRequestSchema } from './comparison.schemas.js';
import {
  getComparisonPriceRange,
  listComparisonCurrencies,
  runComparison,
} from './comparison.service.js';

/**
 * The customer-facing comparison.
 *
 * `POST` because the request carries a list of selected benefits, but it only
 * ever READS: nothing here writes to the database. That is why the router is
 * mounted ahead of the staff-only write gate — a public aggregator has to be
 * able to run a comparison without holding a staff token.
 */
export const comparisonRouter: Router = Router();

comparisonRouter.get(
  '/currencies',
  asyncHandler(async (_req, res) => {
    res.json(success(await listComparisonCurrencies()));
  }),
);

/** What the matching plans cost, so a budget can be proposed from real prices. */
comparisonRouter.post(
  '/price-range',
  asyncHandler(async (req, res) => {
    res.json(success(await getComparisonPriceRange(comparisonPriceRangeSchema.parse(req.body))));
  }),
);

comparisonRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.json(success(await runComparison(comparisonRequestSchema.parse(req.body))));
  }),
);
