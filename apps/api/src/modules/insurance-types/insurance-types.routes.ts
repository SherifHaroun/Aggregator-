import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { listQuerySchema } from '../../lib/pagination.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createInsuranceTypeSchema, updateInsuranceTypeSchema } from './insurance-types.schemas.js';
import {
  createInsuranceType,
  deleteInsuranceType,
  getInsuranceType,
  listInsuranceTypes,
  updateInsuranceType,
} from './insurance-types.service.js';

export const insuranceTypesRouter: Router = Router();

insuranceTypesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(success(await listInsuranceTypes(listQuerySchema.parse(req.query))));
  }),
);

insuranceTypesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(success(await createInsuranceType(createInsuranceTypeSchema.parse(req.body))));
  }),
);

insuranceTypesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await getInsuranceType(param(req, 'id'))));
  }),
);

insuranceTypesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(
      success(
        await updateInsuranceType(param(req, 'id'), updateInsuranceTypeSchema.parse(req.body)),
      ),
    );
  }),
);

insuranceTypesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteInsuranceType(param(req, 'id'));
    res.status(204).send();
  }),
);
