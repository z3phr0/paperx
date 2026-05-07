/**
 * Numeric helpers for px-shaped CSS values displayed in input fields.
 *
 * getComputedStyle frequently returns sub-pixel values like "123.456px" —
 * fine for layout, but ugly inside a numeric input. We round at the
 * display boundary (pxToInt) and at the commit boundary (formatLengthPx)
 * so the user never sees a decimal in a panel input.
 */

export function pxToInt(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'auto') return '';
  const m = trimmed.match(/^(-?[\d.]+)px$/);
  if (m && m[1] != null) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? String(Math.round(n)) : '';
  }
  return trimmed;
}

/**
 * Round a px-shaped value while preserving the "px" suffix.
 * "14.4px" → "14px". Non-px input is returned verbatim.
 * Use when the input display keeps the unit visible (e.g. Typography).
 */
export function roundPx(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const m = trimmed.match(/^(-?[\d.]+)px$/);
  if (m && m[1] != null) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? `${Math.round(n)}px` : trimmed;
  }
  return trimmed;
}

export function formatLengthPx(
  raw: string,
  opts: { allowNegative?: boolean } = {},
): string | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-') return null;
  if (trimmed === 'auto') return 'auto';
  if (/[a-z%]+$/i.test(trimmed)) return trimmed;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (!opts.allowNegative && rounded < 0) return '0px';
  return `${rounded}px`;
}
