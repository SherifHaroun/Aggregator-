import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { reorderSchema } from '../../lib/ordering.js';
import { listQuerySchema } from '../../lib/pagination.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  createInsuranceOptionSchema,
  optionFieldInputSchema,
  updateInsuranceOptionSchema,
  updateOptionFieldSchema,
} from './insurance-options.schemas.js';
import {
  createInsuranceOption,
  createOptionField,
  deleteInsuranceOption,
  deleteOptionField,
  getInsuranceOption,
  listInsuranceOptions,
  listOptionFields,
  reorderInsuranceOptions,
  reorderOptionFields,
  updateInsuranceOption,
  updateOptionField,
} from './insurance-options.service.js';

export const insuranceOptionsRouter: Router = Router();

insuranceOptionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(success(await listInsuranceOptions(listQuerySchema.parse(req.query))));
  }),
);

insuranceOptionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(success(await createInsuranceOption(createInsuranceOptionSchema.parse(req.body))));
  }),
);

/** Reorder the catalogue. Declared before `/:id` so it is not shadowed. */
insuranceOptionsRouter.post(
  '/reorder',
  asyncHandler(async (req, res) => {
    await reorderInsuranceOptions(reorderSchema.parse(req.body).orderedIds);
    res.status(204).send();
  }),
);

insuranceOptionsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await getInsuranceOption(param(req, 'id'))));
  }),
);

insuranceOptionsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(
      success(
        await updateInsuranceOption(param(req, 'id'), updateInsuranceOptionSchema.parse(req.body)),
      ),
    );
  }),
);

insuranceOptionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteInsuranceOption(param(req, 'id'));
    res.status(204).send();
  }),
);

// --- Option fields, nested under their option -------------------------------

insuranceOptionsRouter.get(
  '/:id/fields',
  asyncHandler(async (req, res) => {
    res.json(success(await listOptionFields(param(req, 'id'))));
  }),
);

insuranceOptionsRouter.post(
  '/:id/fields',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(
        success(await createOptionField(param(req, 'id'), optionFieldInputSchema.parse(req.body))),
      );
  }),
);

insuranceOptionsRouter.post(
  '/:id/fields/reorder',
  asyncHandler(async (req, res) => {
    await reorderOptionFields(reorderSchema.parse(req.body).orderedIds);
    res.status(204).send();
  }),
);

// --- Option fields, addressed directly --------------------------------------

export const optionFieldsRouter: Router = Router();

optionFieldsRouter.patch(
  '/:fieldId',
  asyncHandler(async (req, res) => {
    res.json(
      success(
        await updateOptionField(param(req, 'fieldId'), updateOptionFieldSchema.parse(req.body)),
      ),
    );
  }),
);

optionFieldsRouter.delete(
  '/:fieldId',
  asyncHandler(async (req, res) => {
    await deleteOptionField(param(req, 'fieldId'));
    res.status(204).send();
  }),
);
