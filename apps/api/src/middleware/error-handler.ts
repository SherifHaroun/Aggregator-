import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { HttpError, failure } from '../lib/api-response.js';

/**
 * Database constraint violations translated into API errors, in one place, so
 * no service has to pre-check what the database already guarantees.
 */
function fromPrismaError(error: Prisma.PrismaClientKnownRequestError): HttpError | null {
  switch (error.code) {
    case 'P2002': {
      const target = error.meta?.['target'];
      const fields = Array.isArray(target) ? target.join(', ') : String(target ?? 'value');
      return new HttpError(409, 'DUPLICATE', `A record with this ${fields} already exists.`);
    }
    case 'P2003':
      return new HttpError(400, 'INVALID_REFERENCE', 'A referenced record does not exist.');
    case 'P2025':
      return new HttpError(404, 'NOT_FOUND', 'The record was not found.');
    default:
      return null;
  }
}

/** 404 for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    failure({
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
    }),
  );
}

/** Single place that turns any thrown error into an `ApiResponse`. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_';
      (details[key] ??= []).push(issue.message);
    }
    res
      .status(400)
      .json(
        failure({ code: 'VALIDATION_ERROR', message: 'The request payload is invalid.', details }),
      );
    return;
  }

  // Bad credentials / unreachable server: a deployment problem, not a bug.
  if (error instanceof Prisma.PrismaClientInitializationError) {
    if (!env.isProduction) console.error(error.message);
    res.status(503).json(
      failure({
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database is not reachable. Check DATABASE_URL in apps/api/.env.',
      }),
    );
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = fromPrismaError(error);
    if (mapped) {
      res.status(mapped.status).json(failure({ code: mapped.code, message: mapped.message }));
      return;
    }
  }

  if (error instanceof HttpError) {
    res.status(error.status).json(
      failure({
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      }),
    );
    return;
  }

  if (!env.isProduction) {
    console.error(error);
  }

  res
    .status(500)
    .json(failure({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }));
}
