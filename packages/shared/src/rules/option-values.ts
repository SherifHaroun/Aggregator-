/**
 * Converting an edited text value into the type an option field declares.
 *
 * Mirrors what the API stores in its typed columns, so any client that writes
 * option values produces the same shapes. The API remains the authority: an
 * unparseable value is passed through unchanged so its validation message is
 * the single source of truth rather than a second, divergent one here.
 */

import type { OptionFieldDataType } from '../config/option-field-types.js';

export function parseOptionValue(
  dataType: OptionFieldDataType,
  raw: string,
): number | string | boolean | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  switch (dataType) {
    case 'BOOLEAN':
      return trimmed === 'true';
    case 'TEXT':
      return trimmed;
    /**
     * A ranked value is the chosen answer's id. It must never be coerced: an
     * id is an opaque string, and running it through `Number` would turn one
     * that happened to look numeric into a number the API cannot match.
     */
    case 'RANK':
      return trimmed;
    default: {
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? trimmed : parsed;
    }
  }
}
