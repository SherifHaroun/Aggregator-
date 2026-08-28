import { LIMITATION_SCOPE_IDS } from '@aggregator/shared';
import { Router } from 'express';
import { z } from 'zod';
import { success } from '../../lib/api-response.js';
import { listQuerySchema } from '../../lib/pagination.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createLimitationSchema, updateLimitationSchema } from './limitations.schemas.js';
import {
  createLimitation,
  deleteLimitation,
  getLimitation,
  listLimitations,
  updateLimitation,
} from './limitations.service.js';

/** The catalogue itself. Which plan carries which lives under `/plan-options`. */
export const limitationsRouter: Router = Router();

/** `scope` narrows the list to what one kind of benefit box should offer. */
const limitationListQuerySchema = listQuerySchema.extend({
  scope: z.enum(LIMITATION_SCOPE_IDS).optional(),
});

limitationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(success(await listLimitations(limitationListQuerySchema.parse(req.query))));
  }),
);

limitationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(success(await createLimitation(createLimitationSchema.parse(req.body))));
  }),
);

limitationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await getLimitation(param(req, 'id'))));
  }),
);

limitationsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(
      success(await updateLimitation(param(req, 'id'), updateLimitationSchema.parse(req.body))),
    );
  }),
);

limitationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteLimitation(param(req, 'id'));
    res.status(204).send();
  }),
);
