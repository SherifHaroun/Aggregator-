/**
 * How a plan's code is derived from its name.
 *
 * A business rule, not a form detail: the code identifies the plan within its
 * company and is unique per company, so anything that creates a plan — the
 * admin UI today, an import or a second client later — must derive it the same
 * way.
 */

/** "Basic Plan" -> "BASIC-PLAN". Empty when the name has no usable characters. */
export function derivePlanCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
