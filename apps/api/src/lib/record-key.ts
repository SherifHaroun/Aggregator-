/**
 * Derivation of stable machine keys from employee-entered labels.
 *
 * Used for `InsuranceType.code` and `OptionField.key`, so the frontend and any
 * future import/export have something stable to address a record by, without
 * asking the employee to invent one.
 */

/**
 * "Coverage Percentage" -> "coverage_percentage".
 *
 * NFKD decomposition splits accented letters into a base letter plus combining
 * marks; the `[^a-z0-9]+` pass then drops the marks along with punctuation and
 * whitespace. Labels with no usable characters fall back to `field`.
 */
export function toRecordKey(label: string): string {
  const key = label
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key.length > 0 ? key.slice(0, 64) : 'field';
}

/**
 * Append `_2`, `_3`, ... until the key is unused.
 * `existing` is the set of keys already taken in the same scope.
 */
export function uniqueRecordKey(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
