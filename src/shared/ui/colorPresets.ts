/**
 * Curated default palette for ColorPicker.
 *
 * 4 rows × 8 cols = 32 swatches. Row 1 is a neutral / grayscale ramp with
 * `#00000000` (fully transparent) as the first cell so it doubles as a
 * "clear" affordance. Rows 2-4 are Tailwind 500 / 700 / 300 triplets
 * across 8 hues — visually familiar to designers and predictable in
 * contrast.
 *
 * All values are hex8 to round-trip cleanly through `parseToRgba`/`toHex8`
 * in `ColorPicker.tsx`.
 *
 * Future: when design tokens land, replace the constant body with a
 * token-derived array. Call sites consuming `ColorPicker` keep their
 * default-prop behavior unchanged.
 */
export const DEFAULT_PRESETS: readonly string[] = [
  // Row 1 — neutrals (transparent + grayscale ramp + white)
  '#00000000', '#000000ff', '#1f1f1fff', '#3d3d3dff',
  '#6b6b6bff', '#a3a3a3ff', '#d4d4d4ff', '#ffffffff',

  // Row 2 — vivid (Tailwind 500)
  '#ef4444ff', '#f97316ff', '#f59e0bff', '#eab308ff',
  '#22c55eff', '#06b6d4ff', '#3b82f6ff', '#a855f7ff',

  // Row 3 — deep (Tailwind 700)
  '#b91c1cff', '#c2410cff', '#b45309ff', '#a16207ff',
  '#15803dff', '#0e7490ff', '#1d4ed8ff', '#7e22ceff',

  // Row 4 — pastel (Tailwind 300)
  '#fca5a5ff', '#fdba74ff', '#fcd34dff', '#fde047ff',
  '#86efacff', '#67e8f9ff', '#93c5fdff', '#d8b4feff',
];
