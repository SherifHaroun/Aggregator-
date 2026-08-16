/** Standard error constructors, so error codes and wording stay consistent. */

import { HttpError } from './api-response.js';

export { HttpError };

export function notFound(entity: string): HttpError {
  return new HttpError(404, 'NOT_FOUND', `${entity} was not found.`);
}

export function badRequest(message: string, details?: Record<string, string[]>): HttpError {
  return new HttpError(400, 'BAD_REQUEST', message, details);
}

export function conflict(message: string, details?: Record<string, string[]>): HttpError {
  return new HttpError(409, 'CONFLICT', message, details);
}

/**
 * Raised when a record cannot be deleted because other records depend on it.
 * Deactivation is the intended action in that case — historical comparisons and
 * reports must keep resolving.
 */
export function inUse(entity: string, usedBy: string): HttpError {
  return conflict(
    `This ${entity} is used by ${usedBy} and cannot be deleted. Deactivate it instead.`,
  );
}
