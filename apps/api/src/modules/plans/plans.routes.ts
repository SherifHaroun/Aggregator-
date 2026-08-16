import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { listQuerySchema } from '../../lib/pagination.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { listPlanConfigurations } from '../plan-configurations/plan-configurations.service.js';
import { createPlanSchema, listPlansQueryExtension, updatePlanSchema } from './plans.schemas.js';
import { createPlan, deletePlan, getPlan, listPlans, updatePlan } from './plans.service.js';

const listQuery = listQuerySchema.merge(listPlansQueryExtension);

export const plansRouter: Router = Router();

plansRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(success(await listPlans(listQuery.parse(req.query))));
  }),
);

plansRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(success(await createPlan(createPlanSchema.parse(req.body))));
  }),
);

plansRouter.get(
  '/:planId',
  asyncHandler(async (req, res) => {
    res.json(success(await getPlan(param(req, 'planId'))));
  }),
);

plansRouter.patch(
  '/:planId',
  asyncHandler(async (req, res) => {
    res.json(success(await updatePlan(param(req, 'planId'), updatePlanSchema.parse(req.body))));
  }),
);

plansRouter.delete(
  '/:planId',
  asyncHandler(async (req, res) => {
    await deletePlan(param(req, 'planId'));
    res.status(204).send();
  }),
);

/**
 * Configurations of this plan.
 *
 * Creating, updating and configuring them — including their options — happens
 * under `/plan-configurations`, so there is one home for that logic.
 */
plansRouter.get(
  '/:planId/configurations',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    res.json(success(await listPlanConfigurations({ ...query, planId: param(req, 'planId') })));
  }),
);
