/**
 * useComputedStyle — re-seed editor fields from `getComputedStyle(target)`
 * whenever the selected target changes. paperx writes inline styles via
 * StyleEditService, so reading inline first then falling back to computed
 * lets the UI mirror exactly what the user sees (host styles included).
 */
import * as React from 'react';

import { pxToInt } from '@/shared/types/numeric';

function readInlineOrComputed(target: HTMLElement, prop: string): string {
  const inline = target.style.getPropertyValue(prop);
  if (inline) return inline;
  try {
    return getComputedStyle(target).getPropertyValue(prop) ?? '';
  } catch {
    return '';
  }
}

/**
 * Returns an int-px string for the given CSS property (e.g. `'14'` for
 * `14.4px`). Empty string when the property is unset / `auto`.
 */
export function readPx(target: HTMLElement, prop: string): string {
  return pxToInt(readInlineOrComputed(target, prop).trim());
}

/**
 * Re-seed a string field from `getComputedStyle` whenever the target
 * reference changes. Returns the live state pair so consumers can keep
 * the field controlled.
 */
export function useSeededValue(
  target: HTMLElement,
  prop: string,
): [string, React.Dispatch<React.SetStateAction<string>>] {
  const seed = React.useMemo(() => readPx(target, prop), [target, prop]);
  const [value, setValue] = React.useState(seed);
  React.useEffect(() => setValue(seed), [seed]);
  return [value, setValue];
}

/**
 * Re-seed many props at once. The returned object maps the original prop
 * names back to their initial int-px strings.
 */
export function useSeededValues<K extends string>(
  target: HTMLElement,
  props: ReadonlyArray<K>,
): [Record<K, string>, React.Dispatch<React.SetStateAction<Record<K, string>>>] {
  const seed = React.useMemo(() => {
    const out = {} as Record<K, string>;
    for (const p of props) out[p] = readPx(target, p);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, props.join('|')]);
  const [vals, setVals] = React.useState<Record<K, string>>(seed);
  React.useEffect(() => setVals(seed), [seed]);
  return [vals, setVals];
}
