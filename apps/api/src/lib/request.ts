import type { Request } from 'express';
import { badRequest } from './errors.js';

/** Read a required route parameter, keeping handlers free of non-null assertions. */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (value === undefined || value === '') {
    throw badRequest(`Missing route parameter: ${name}`);
  }
  return value;
}
