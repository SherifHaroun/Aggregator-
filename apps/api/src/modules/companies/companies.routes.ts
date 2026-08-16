import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { listQuerySchema } from '../../lib/pagination.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createCompanySchema, updateCompanySchema } from './companies.schemas.js';
import {
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  updateCompany,
} from './companies.service.js';

export const companiesRouter: Router = Router();

companiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(success(await listCompanies(listQuerySchema.parse(req.query))));
  }),
);

companiesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(success(await createCompany(createCompanySchema.parse(req.body))));
  }),
);

companiesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await getCompany(param(req, 'id'))));
  }),
);

companiesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await updateCompany(param(req, 'id'), updateCompanySchema.parse(req.body))));
  }),
);

/** Permanent delete. Blocked while plans reference the company — deactivate instead. */
companiesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteCompany(param(req, 'id'));
    res.status(204).send();
  }),
);
