import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { param } from '../../lib/request.js';
import { requireAdmin } from '../../middleware/access.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  listNotifications,
  markAllNotificationsSeen,
  markNotificationSeen,
} from './leads.service.js';

/**
 * THE EMPLOYEE'S BELL. A notification IS a lead: one line per visit to the
 * customer site, saying the last thing the visitor did, unseen until an
 * employee looks at it and unseen again when the visitor does more.
 */
export const notificationsRouter: Router = Router();

notificationsRouter.use(requireAdmin);

notificationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(success(await listNotifications()));
  }),
);

notificationsRouter.post(
  '/seen',
  asyncHandler(async (_req, res) => {
    res.json(success(await markAllNotificationsSeen()));
  }),
);

notificationsRouter.post(
  '/:id/seen',
  asyncHandler(async (req, res) => {
    res.json(success(await markNotificationSeen(param(req, 'id'))));
  }),
);
