import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { reorderSchema } from '../../lib/ordering.js';
import { listQuerySchema } from '../../lib/pagination.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { addPlanOptionSchema } from '../plan-options/plan-options.schemas.js';
import {
  addPlanOption,
  listPlanOptions,
  reorderPlanOptions,
} from '../plan-options/plan-options.service.js';
import {
  createPlanConfigurationSchema,
  listPlanConfigurationsQueryExtension,
  updatePlanConfigurationSchema,
} from './plan-configurations.schemas.js';
import {
  createPlanConfiguration,
  deletePlanConfiguration,
  getPlanConfiguration,
  listPlanConfigurations,
  updatePlanConfiguration,
} from './plan-configurations.service.js';

const listQuery = listQuerySchema.merge(listPlanConfigurationsQueryExtension);

export const planConfigurationsRouter: Router = Router();

/**
 * `?customerType=&geographicalCoverage=&isActive=true` is the search the
 * comparison engine will use: every matching configuration, across all
 * companies and plans.
 */
planConfigurationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(success(await listPlanConfigurations(listQuery.parse(req.query))));
  }),
);

planConfigurationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(success(await createPlanConfiguration(createPlanConfigurationSchema.parse(req.body))));
  }),
);

planConfigurationsRouter.get(
  '/:configurationId',
  asyncHandler(async (req, res) => {
    res.json(success(await getPlanConfiguration(param(req, 'configurationId'))));
  }),
);

/** Also how a configuration is deactivated: `{ "isActive": false }`. */
planConfigurationsRouter.patch(
  '/:configurationId',
  asyncHandler(async (req, res) => {
    res.json(
      success(
        await updatePlanConfiguration(
          param(req, 'configurationId'),
          updatePlanConfigurationSchema.parse(req.body),
        ),
      ),
    );
  }),
);

planConfigurationsRouter.delete(
  '/:configurationId',
  asyncHandler(async (req, res) => {
    await deletePlanConfiguration(param(req, 'configurationId'));
    res.status(204).send();
  }),
);

// --- Options attached to a configuration ------------------------------------

planConfigurationsRouter.get(
  '/:configurationId/options',
  asyncHandler(async (req, res) => {
    res.json(success(await listPlanOptions(param(req, 'configurationId'))));
  }),
);

/** Attach an option to this configuration — the write behind a drag-and-drop drop. */
planConfigurationsRouter.post(
  '/:configurationId/options',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(
        success(
          await addPlanOption(param(req, 'configurationId'), addPlanOptionSchema.parse(req.body)),
        ),
      );
  }),
);

planConfigurationsRouter.post(
  '/:configurationId/options/reorder',
  asyncHandler(async (req, res) => {
    await reorderPlanOptions(
      param(req, 'configurationId'),
      reorderSchema.parse(req.body).orderedIds,
    );
    res.status(204).send();
  }),
);
