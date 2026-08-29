import { Router } from 'express';
import { success } from '../../lib/api-response.js';
import { listQuerySchema } from '../../lib/pagination.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  createCompanySchema,
  createMedicalNetworkSchema,
  deleteMedicalNetworkQuerySchema,
  reorderMedicalNetworksSchema,
  updateCompanySchema,
  updateMedicalNetworkSchema,
} from './companies.schemas.js';
import {
  createMedicalNetwork,
  deleteMedicalNetwork,
  listMedicalNetworks,
  reorderMedicalNetworks,
  updateMedicalNetwork,
} from './medical-networks.service.js';
import {
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  updateCompany,
} from './companies.service.js';

export const companiesRouter: Router = Router();

// --- the provider networks this company sells -------------------------------
//
// Nested under the company because that is who owns them: a plan picks one of
// its own company's networks, and never types a network of its own.

companiesRouter.get(
  '/:id/medical-networks',
  asyncHandler(async (req, res) => {
    res.json(success(await listMedicalNetworks(param(req, 'id'))));
  }),
);

companiesRouter.post(
  '/:id/medical-networks',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(
        success(
          await createMedicalNetwork(param(req, 'id'), createMedicalNetworkSchema.parse(req.body)),
        ),
      );
  }),
);

/** The company's own ranking of its networks. Declared before `/:networkId`. */
companiesRouter.post(
  '/:id/medical-networks/reorder',
  asyncHandler(async (req, res) => {
    const { orderedIds } = reorderMedicalNetworksSchema.parse(req.body);
    await reorderMedicalNetworks(param(req, 'id'), orderedIds);
    res.status(204).send();
  }),
);

companiesRouter.patch(
  '/:id/medical-networks/:networkId',
  asyncHandler(async (req, res) => {
    res.json(
      success(
        await updateMedicalNetwork(
          param(req, 'networkId'),
          updateMedicalNetworkSchema.parse(req.body),
        ),
      ),
    );
  }),
);

companiesRouter.delete(
  '/:id/medical-networks/:networkId',
  asyncHandler(async (req, res) => {
    const { force } = deleteMedicalNetworkQuerySchema.parse(req.query);
    await deleteMedicalNetwork(param(req, 'networkId'), { force });
    res.status(204).send();
  }),
);

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
