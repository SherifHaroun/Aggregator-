import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PROVIDER_LIST_FILE_TYPES, PROVIDER_LIST_MAX_BYTES } from '@aggregator/shared';
import { Router } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { success } from '../../lib/api-response.js';
import { badRequest } from '../../lib/errors.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  createMedicalNetworkSchema,
  deleteMedicalNetworkQuerySchema,
  listMedicalNetworksQuerySchema,
  reorderMedicalNetworksSchema,
  updateMedicalNetworkSchema,
} from './medical-networks.schemas.js';
import {
  clearProviderList,
  createMedicalNetwork,
  deleteMedicalNetwork,
  getMedicalNetwork,
  listMedicalNetworks,
  reorderMedicalNetworks,
  resolveProviderList,
  resolveProviderListVersion,
  setProviderList,
  updateMedicalNetwork,
} from './medical-networks.service.js';

/**
 * The provider list as the insurer sent it.
 *
 * Accepted by extension as well as by MIME type: browsers report a spreadsheet
 * as `application/octet-stream` often enough that trusting the type alone
 * would refuse real files. Stored under a random name — the insurer's own name
 * is kept on the record and given back on download.
 */
const ACCEPTED_EXTENSIONS = new Set(PROVIDER_LIST_FILE_TYPES.map((type) => type.extension));
const EXTENSION_BY_MIME = new Map(
  PROVIDER_LIST_FILE_TYPES.map((type) => [type.mimeType, type.extension]),
);

function providerListExtension(file: { mimetype: string; originalname: string }): string | null {
  const byExtension = extname(file.originalname).toLowerCase();
  if (ACCEPTED_EXTENSIONS.has(byExtension)) return byExtension;
  return EXTENSION_BY_MIME.get(file.mimetype) ?? null;
}

const uploadProviderList = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => done(null, env.uploadDir),
    filename: (_req, file, done) => {
      done(null, `${randomUUID()}${providerListExtension(file) ?? ''}`);
    },
  }),
  limits: { fileSize: PROVIDER_LIST_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, done) => {
    if (providerListExtension(file) === null) {
      done(badRequest('Upload the provider list as an Excel, CSV or PDF file.'));
      return;
    }
    done(null, true);
  },
});

export const medicalNetworksRouter: Router = Router();

medicalNetworksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(success(await listMedicalNetworks(listMedicalNetworksQuerySchema.parse(req.query))));
  }),
);

medicalNetworksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(success(await createMedicalNetwork(createMedicalNetworkSchema.parse(req.body))));
  }),
);

/** The list's order, best first. Declared before `/:id`. */
medicalNetworksRouter.post(
  '/reorder',
  asyncHandler(async (req, res) => {
    const { orderedIds } = reorderMedicalNetworksSchema.parse(req.body);
    await reorderMedicalNetworks(orderedIds);
    res.status(204).send();
  }),
);

medicalNetworksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(success(await getMedicalNetwork(param(req, 'id'))));
  }),
);

medicalNetworksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(
      success(
        await updateMedicalNetwork(param(req, 'id'), updateMedicalNetworkSchema.parse(req.body)),
      ),
    );
  }),
);

medicalNetworksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { force } = deleteMedicalNetworkQuerySchema.parse(req.query);
    await deleteMedicalNetwork(param(req, 'id'), { force });
    res.status(204).send();
  }),
);

// --- the provider list --------------------------------------------------------

/**
 * THE STABLE DOWNLOAD. This is the address a plan's PDF carries, keyed on the
 * network and never on the file, so it hands out whatever list is current.
 * A read, so it needs no token: a customer holding the PDF is who it is for.
 */
medicalNetworksRouter.get(
  '/:id/provider-list',
  asyncHandler(async (req, res) => {
    const { path, fileName } = await resolveProviderList(param(req, 'id'));
    res.download(path, fileName);
  }),
);

/** A past issue of the list, from the network's history. */
medicalNetworksRouter.get(
  '/:id/provider-list/versions/:versionId',
  asyncHandler(async (req, res) => {
    const { path, fileName } = await resolveProviderListVersion(
      param(req, 'id'),
      param(req, 'versionId'),
    );
    res.download(path, fileName);
  }),
);

/** Replace the provider list — multipart form field `file`. */
medicalNetworksRouter.put(
  '/:id/provider-list',
  uploadProviderList.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file was uploaded.');
    res.json(
      success(
        await setProviderList(param(req, 'id'), {
          storedUrl: `${env.uploadPublicPath}/${req.file.filename}`,
          // Multer decodes the name as Latin-1; insurers name files in Arabic.
          originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        }),
      ),
    );
  }),
);

medicalNetworksRouter.delete(
  '/:id/provider-list',
  asyncHandler(async (req, res) => {
    res.json(success(await clearProviderList(param(req, 'id'))));
  }),
);
