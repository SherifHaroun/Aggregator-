import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { getComparisonConfiguration } from './configuration.service.js';

export const configurationRouter: Router = Router();

/** GET /api/v1/configuration/comparison — options and rules for the comparison screen. */
configurationRouter.get('/comparison', (_req, res) => {
  res.json(success(getComparisonConfiguration()));
});
