/**
 * Image uploads — currently only company logos.
 *
 * Files are written to `UPLOAD_DIR` and served statically from `/uploads`.
 * The endpoint returns the public path; callers store that path on the record
 * (e.g. `Company.logoUrl`). Nothing about insurance data lives here.
 */

import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { success } from '../../lib/api-response.js';
import { env } from '../../config/env.js';
import { badRequest } from '../../lib/errors.js';

/** Extensions accepted for an uploaded image, keyed by MIME type. */
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/gif': '.gif',
};

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => done(null, env.uploadDir),
    filename: (_req, file, done) => {
      const extension = ALLOWED_IMAGE_TYPES[file.mimetype] ?? extname(file.originalname);
      done(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, done) => {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      done(badRequest('Only PNG, JPEG, WEBP, SVG and GIF images are accepted.'));
      return;
    }
    done(null, true);
  },
});

export const uploadsRouter: Router = Router();

/** POST /api/v1/uploads/image — multipart form field `file`. */
uploadsRouter.post('/image', upload.single('file'), (req, res) => {
  if (!req.file) throw badRequest('No file was uploaded.');
  res.status(201).json(success({ url: `${env.uploadPublicPath}/${req.file.filename}` }));
});
