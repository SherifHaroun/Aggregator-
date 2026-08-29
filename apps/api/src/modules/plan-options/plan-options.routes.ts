import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  setPlanOptionChoicesSchema,
  setPlanOptionConditionSchema,
  setPlanOptionNoteSchema,
  setPlanOptionValueSchema,
  setPlanOptionValuesSchema,
} from './plan-options.schemas.js';
import {
  getPlanOption,
  removePlanOption,
  setPlanOptionChoices,
  setPlanOptionCondition,
  setPlanOptionNote,
  setPlanOptionValue,
  setPlanOptionValues,
} from './plan-options.service.js';

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

/**
 * One value, named by its field. The other values of the same benefit — its
 * alternative, say — are left exactly as they are.
 */
planOptionsRouter.put(
  '/:planOptionId/values/:optionFieldId',
  asyncHandler(async (req, res) => {
    const { value } = setPlanOptionValueSchema.parse(req.body);
    res.json(
      success(
        await setPlanOptionValue(param(req, 'planOptionId'), param(req, 'optionFieldId'), value),
      ),
    );
  }),
);

/** The remark shown beside the benefit's value on this configuration. */
planOptionsRouter.patch(
  '/:planOptionId/note',
  asyncHandler(async (req, res) => {
    const { note } = setPlanOptionNoteSchema.parse(req.body);
    res.json(success(await setPlanOptionNote(param(req, 'planOptionId'), note)));
  }),
);

/**
 * The answers ticked on ONE setting of this benefit.
 *
 * A full replace for that setting, and an empty array states that none of its
 * answers apply. Addressed by setting because a benefit has several and they
 * are filled in independently.
 */
/**
 * Whether an additional condition applies to this benefit.
 *
 * Switching it on says the document states the condition, even before a figure
 * is entered; switching it off removes it and anything it revealed.
 */
planOptionsRouter.put(
  '/:planOptionId/conditions/:optionFieldId',
  asyncHandler(async (req, res) => {
    const { enabled } = setPlanOptionConditionSchema.parse(req.body);
    res.json(
      success(
        await setPlanOptionCondition(
          param(req, 'planOptionId'),
          param(req, 'optionFieldId'),
          enabled,
        ),
      ),
    );
  }),
);

planOptionsRouter.put(
  '/:planOptionId/settings/:optionFieldId/choices',
  asyncHandler(async (req, res) => {
    const { choiceIds } = setPlanOptionChoicesSchema.parse(req.body);
    res.json(
      success(
        await setPlanOptionChoices(
          param(req, 'planOptionId'),
          param(req, 'optionFieldId'),
          choiceIds,
        ),
      ),
    );
  }),
);

planOptionsRouter.delete(
  '/:planOptionId',
  asyncHandler(async (req, res) => {
    await removePlanOption(param(req, 'planOptionId'));
    res.status(204).send();
  }),
);
