import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { reorderSchema } from '../../lib/ordering.js';
import { listQuerySchema } from '../../lib/pagination.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  createInsuranceOptionSchema,
  createOptionChoiceSchema,
  deleteInsuranceOptionQuerySchema,
  optionFieldInputSchema,
  reorderOptionChoicesSchema,
  updateInsuranceOptionSchema,
  updateOptionChoiceSchema,
  updateOptionFieldSchema,
} from './insurance-options.schemas.js';
import {
  createOptionChoice,
  deleteOptionChoice,
  listOptionChoices,
  reorderOptionChoices,
  updateOptionChoice,
} from './option-choices.service.js';
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

/**
 * Delete a benefit from the catalogue.
 *
 * `?force=true` carries the deletion through when configurations still carry
 * the benefit, or when a group still holds sub-benefits. Without it, either
 * case is refused with a message saying what depends on it.
 */
insuranceOptionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { force } = deleteInsuranceOptionQuerySchema.parse(req.query);
    await deleteInsuranceOption(param(req, 'id'), { force });
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

// --- The answers a benefit offers, nested under it --------------------------

insuranceOptionsRouter.get(
  '/:id/choices',
  asyncHandler(async (req, res) => {
    res.json(success(await listOptionChoices(param(req, 'id'))));
  }),
);

insuranceOptionsRouter.post(
  '/:id/choices',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(
        success(
          await createOptionChoice(param(req, 'id'), createOptionChoiceSchema.parse(req.body)),
        ),
      );
  }),
);

/**
 * Put the answers in order — on a ranked benefit, THIS is the ranking.
 *
 * Declared before `/:id/choices/:choiceId` so "reorder" is never read as an id.
 */
insuranceOptionsRouter.post(
  '/:id/choices/reorder',
  asyncHandler(async (req, res) => {
    const { orderedIds } = reorderOptionChoicesSchema.parse(req.body);
    await reorderOptionChoices(param(req, 'id'), orderedIds);
    res.status(204).send();
  }),
);

insuranceOptionsRouter.patch(
  '/:id/choices/:choiceId',
  asyncHandler(async (req, res) => {
    res.json(
      success(
        await updateOptionChoice(param(req, 'choiceId'), updateOptionChoiceSchema.parse(req.body)),
      ),
    );
  }),
);

insuranceOptionsRouter.delete(
  '/:id/choices/:choiceId',
  asyncHandler(async (req, res) => {
    await deleteOptionChoice(param(req, 'choiceId'));
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
