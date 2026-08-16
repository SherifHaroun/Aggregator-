import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { isDatabaseConfigured } from '../../lib/prisma.js';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req, res) => {
  res.json(
    success({
      status: 'ok',
      databaseConfigured: isDatabaseConfigured(),
    }),
  );
});
