/**
 * How a plan's code is derived from its name and the buyer it is sold to.
 *
 * A business rule, not a form detail: the code identifies the plan within its
 * company and is unique per company, so anything that creates a plan — the
 * admin UI today, an import or a second client later — must derive it the same
 * way.
 *
 * THE CUSTOMER TYPE IS PART OF IT, and that is the whole point. A company sells
 * "Platinum" to individuals, to families and to SMEs; those are three separate
 * products that merely share a name, and the name alone cannot identify any of
 * them. Deriving from the name only meant the second one collided with the
 * first and could not be saved at all.
 */

import type { CustomerTypeId } from '../config/customer-types.js';

/** The name part alone: "Basic Plan" -> "BASIC-PLAN". */
function slug(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * "Platinum" sold to individuals -> "PLATINUM-INDIVIDUAL".
 *
 * Empty when the name has no usable characters, so a caller can tell the
 * employee to enter a code rather than saving a plan identified by its buyer
 * alone.
 */
export function derivePlanCode(name: string, customerType: CustomerTypeId): string {
  const base = slug(name);
  if (base === '') return '';
  /**
   * The suffix is never truncated away. It is what makes the code unique
   * within the company, so a very long plan name loses its own tail instead.
   */
  const suffix = `-${customerType}`;
  return `${base.slice(0, 60 - suffix.length)}${suffix}`;
}
