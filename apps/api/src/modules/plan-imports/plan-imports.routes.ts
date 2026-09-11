/**
 * Plan imports: a Word document in, a job id out, the answer when it is ready.
 *
 *   POST /plan-imports?companyId=&customerType=   multipart field `file`
 *   GET  /plan-imports/:jobId
 *
 * The upload is held in memory only for as long as it takes to convert it;
 * the document itself is never written to disk. Publishing the reviewed
 * plans goes through the ordinary plan endpoints, not through here.
 */

import { extname } from 'node:path';
import {
  CUSTOMER_TYPE_IDS,
  PLAN_IMPORT_ACCEPTED_EXTENSION,
  PLAN_IMPORT_ACCEPTED_MIME,
  PLAN_IMPORT_MAX_UPLOAD_BYTES,
} from '@aggregator/shared';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { success } from '../../lib/api-response.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getPrisma } from '../../lib/prisma.js';
import { param } from '../../lib/request.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createPlanImport, getPlanImport } from './plan-imports.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PLAN_IMPORT_MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, done) => {
    const isWord =
      file.mimetype === PLAN_IMPORT_ACCEPTED_MIME ||
      extname(file.originalname).toLowerCase() === PLAN_IMPORT_ACCEPTED_EXTENSION;
    if (!isWord) {
      done(badRequest('Only Word documents (.docx) are accepted.'));
      return;
    }
    done(null, true);
  },
});

/** Where the plans go: the company, and which of its three sections. */
const startPlanImportSchema = z.object({
  companyId: z.string().min(1),
  customerType: z.enum(CUSTOMER_TYPE_IDS),
});

export const planImportsRouter: Router = Router();

planImportsRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const { companyId, customerType } = startPlanImportSchema.parse(req.query);
    if (!req.file) throw badRequest('No file was uploaded.');

    const company = await getPrisma().company.findUnique({ where: { id: companyId } });
    if (!company) throw notFound('Company');

    const job = createPlanImport({
      companyId,
      companyName: company.name,
      customerType,
      fileName: req.file.originalname,
      file: req.file.buffer,
    });
    res.status(202).json(success(job));
  }),
);

planImportsRouter.get(
  '/:jobId',
  asyncHandler(async (req, res) => {
    const job = getPlanImport(param(req, 'jobId'));
    if (!job) throw notFound('Import');
    res.json(success(job));
  }),
);
