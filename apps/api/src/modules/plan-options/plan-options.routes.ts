import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { setPlanOptionValuesSchema } from './plan-options.schemas.js';
import { getPlanOption, removePlanOption, setPlanOptionValues } from './plan-options.service.js';

/**
 * Plan options addressed directly by id.
 * Creating and reordering them happens under `/plans/:planId/options`.
 */
export const planOptionsRouter: Router = Router();

planOptionsRouter.get(
  '/:planOptionId',
  asyncHandler(async (req, res) => {
    res.json(success(await getPlanOption(param(req, 'planOptionId'))));
  }),
);

/** Replace the configured values of this option within its plan. */
planOptionsRouter.put(
  '/:planOptionId/values',
  asyncHandler(async (req, res) => {
    const { values } = setPlanOptionValuesSchema.parse(req.body);
    res.json(success(await setPlanOptionValues(param(req, 'planOptionId'), values)));
  }),
);

planOptionsRouter.delete(
  '/:planOptionId',
  asyncHandler(async (req, res) => {
    await removePlanOption(param(req, 'planOptionId'));
    res.status(204).send();
  }),
);
