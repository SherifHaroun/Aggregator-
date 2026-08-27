/**
 * Grouping digits as they are typed.
 *
 * An employee entering a limit types 100000 and has to count the zeros to know
 * what they typed. Everywhere a figure is entered or displayed it is grouped —
 * 100,000 — and this is the one implementation of that, so the admin form, the
 * benefit values and any future client group identically.
 *
 * The functions are pure string work: the value that reaches the API is always
 * the ungrouped one, so nothing downstream ever sees a separator.
 */

/** Digits grouped in threes, e.g. "1234567" -> "1,234,567". */
function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The text to show in a number field for what the employee has typed so far.
 *
 * Everything that is not a digit, a decimal point or a leading minus is
 * dropped, so pasting "1,000 EGP" leaves "1,000". A trailing decimal point is
 * preserved — the employee is mid-way through typing "1,000." and removing it
 * would fight them.
 */
export function formatNumberInput(raw: string): string {
  const negative = raw.trim().startsWith('-');
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (cleaned === '') return negative ? '-' : '';

  const [whole = '', ...rest] = cleaned.split('.');
  const decimals = rest.join('');
  const sign = negative ? '-' : '';
  const grouped = groupDigits(whole);

  if (!cleaned.includes('.')) return `${sign}${grouped}`;
  return `${sign}${grouped}.${decimals}`;
}

/**
 * The value to send: the same text with the separators taken out.
 * An empty or partial entry ("", "-", ".") becomes an empty string, which every
 * caller already treats as "not specified".
 */
export function parseNumberInput(text: string): string {
  const negative = text.trim().startsWith('-');
  const cleaned = text.replace(/[^\d.]/g, '');
  if (cleaned === '' || cleaned === '.') return '';
  return `${negative ? '-' : ''}${cleaned}`;
}

/** A stored number as grouped text, e.g. 100000 -> "100,000". */
export function formatNumberValue(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}
