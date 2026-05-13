/**
 * ColorPicker — Figma-style swatch trigger + Radix Popover + react-color
 * SketchPicker (replaces react-colorful in v0.5.0).
 *
 * Why react-color: react-colorful had a Shadow-DOM + Radix Portal-container
 * pointer-event quirk that intermittently swallowed saturation-area clicks.
 * react-color's SketchPicker uses pure React mouseDown/mouseMove handlers
 * that compose normally through the shadow boundary.
 *
 * Design contract:
 *
 *   1. The popover MUST mount inside the shadow tree via
 *      `<Popover.Portal container={usePortalContainer()}>`. Without it,
 *      Radix portals to `document.body`, host-page CSS bleeds in, and
 *      paperx Tailwind tokens are no longer in scope.
 *
 *   2. Live preview vs commit are split:
 *        - `onPreview(hex8)` — fires every drag (SketchPicker `onChange`)
 *        - `onChange(hex8)`  — fires on popover dismiss (when the user
 *          actually moved the color) or on Recent / Preset pick
 *      Output is always an 8-char hex string `#RRGGBBAA`. The Border
 *      section in v0.5.0 consumes alpha; older callers (Background,
 *      Typography, GradientEditor) accept hex8 transparently — CSS reads
 *      both hex6 and hex8.
 *
 *   3. Recent colors persist in sessionStorage under `paperx.recentColors`
 *      (LRU, max 8). Failures fall back to a module-level array so the
 *      picker still works in restricted contexts.
 */
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { SketchPicker, type ColorResult } from 'react-color';

import { usePortalContainer } from '@/shared/ui/portal';
import { Swatch } from '@/shared/ui-v2/Swatch';
import { cn } from '@/shared/ui/utils';
import { DEFAULT_PRESETS } from '@/shared/ui/colorPresets';

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Live-drag callback. Optional. Parent uses this to drive a tracking
   * preview without polluting ChangeLog (commit happens via onChange on
   * close). When omitted, live preview is a no-op.
   */
  onPreview?: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  /**
   * Curated palette shown below the SketchPicker. Always rendered when
   * non-empty; pass `[]` to suppress. Defaults to `DEFAULT_PRESETS`.
   * Future design-token integration replaces the default constant in
   * `colorPresets.ts` — call sites stay untouched.
   */
  presets?: readonly string[];
  /**
   * Trigger visual:
   *   - 'v1' (default): legacy 24 px Tailwind pill. Background / Typography
   *     / GradientEditor / Border-v1 consumers see no change.
   *   - 'v2': design-v2 row primitive — 28 px tall, `--dv-bg-input` bg,
   *     `--dv-r-input` radius, hover + focus states matching `.dv-input`.
   *     Uses the shared `<Swatch>` from `src/shared/ui-v2/Swatch.tsx`.
   */
  triggerVariant?: 'v1' | 'v2';
}

// ---------------------------------------------------------------------------
// Color normalization — accept any CSS-ish color, emit hex8.
// ---------------------------------------------------------------------------

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX_FULL = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const HEX_SHORT = /^#([0-9a-f]{3})([0-9a-f])?$/i;
const RGB_RE = /^rgba?\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*(?:,\s*(-?\d*\.?\d+)\s*)?\)$/i;

const NAMED_COLORS: Readonly<Record<string, RGBA>> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  green: { r: 0, g: 128, b: 0, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex2(n: number): string {
  return clamp255(n).toString(16).padStart(2, '0');
}

export function parseToRgba(input: string): RGBA | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (!v) return null;

  let m = HEX_FULL.exec(v);
  if (m) {
    const hex = m[1]!;
    const alphaHex = m[2];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = alphaHex ? parseInt(alphaHex, 16) / 255 : 1;
    return { r, g, b, a };
  }

  m = HEX_SHORT.exec(v);
  if (m) {
    const hex = m[1]!;
    const r = parseInt(hex[0]! + hex[0], 16);
    const g = parseInt(hex[1]! + hex[1], 16);
    const b = parseInt(hex[2]! + hex[2], 16);
    const aShort = m[2];
    const a = aShort ? parseInt(aShort + aShort, 16) / 255 : 1;
    return { r, g, b, a };
  }

  m = RGB_RE.exec(v);
  if (m) {
    return {
      r: clamp255(Number(m[1])),
      g: clamp255(Number(m[2])),
      b: clamp255(Number(m[3])),
      a: m[4] != null ? clamp01(Number(m[4])) : 1,
    };
  }

  if (v in NAMED_COLORS) return { ...NAMED_COLORS[v]! };
  return null;
}

export function toHex8(c: RGBA): string {
  return `#${toHex2(c.r)}${toHex2(c.g)}${toHex2(c.b)}${toHex2(Math.round(c.a * 255))}`;
}

const FALLBACK_RGBA: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const FALLBACK_HEX8 = toHex8(FALLBACK_RGBA);

// ---------------------------------------------------------------------------
// Recent colors (sessionStorage-backed LRU, max 8)
// ---------------------------------------------------------------------------

const RECENTS_KEY = 'paperx.recentColors';
const RECENTS_MAX = 8;

let memoryRecents: string[] = [];

function loadRecents(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENTS_KEY);
    if (!raw) return memoryRecents.slice();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return memoryRecents.slice();
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENTS_MAX);
  } catch {
    return memoryRecents.slice();
  }
}

function saveRecents(list: string[]): void {
  memoryRecents = list.slice(0, RECENTS_MAX);
  try {
    sessionStorage.setItem(RECENTS_KEY, JSON.stringify(memoryRecents));
  } catch {
    // sessionStorage unavailable — memoryRecents already updated.
  }
}

function pushRecent(prev: string[], hex: string): string[] {
  const norm = hex.toLowerCase();
  const filtered = prev.filter((c) => c.toLowerCase() !== norm);
  return [norm, ...filtered].slice(0, RECENTS_MAX);
}

// Transparent checkerboard for the trigger swatch when value is empty.
const CHECKER_BG =
  "url(\"data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><rect width='6' height='6' fill='%23ccc'/><rect x='6' y='6' width='6' height='6' fill='%23ccc'/></svg>\")";

function colorResultToRgba(c: ColorResult): RGBA {
  return {
    r: c.rgb.r,
    g: c.rgb.g,
    b: c.rgb.b,
    a: c.rgb.a ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SwatchGridProps {
  label: string;
  colors: readonly string[];
  testIdPrefix: string;
  onPick: (color: string) => void;
}

function SwatchGrid({ label, colors, testIdPrefix, onPick }: SwatchGridProps): React.ReactElement {
  return (
    <div className="mt-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/50">
        {label}
      </div>
      <div className="grid grid-cols-8 gap-1">
        {colors.map((c, i) => {
          const transparent = (parseToRgba(c)?.a ?? 1) === 0;
          return (
            <button
              key={`${c}-${i}`}
              type="button"
              data-testid={`${testIdPrefix}-${i}`}
              aria-label={`Use ${c}`}
              onClick={() => onPick(c)}
              className={cn(
                'h-5 w-full rounded-sm border border-white/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
              )}
              style={{
                background: transparent ? CHECKER_BG : undefined,
                backgroundColor: transparent ? undefined : c,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ColorPicker({
  value,
  onChange,
  onPreview,
  disabled,
  ariaLabel,
  presets = DEFAULT_PRESETS,
  triggerVariant = 'v1',
}: ColorPickerProps): React.ReactElement {
  const portalContainer = usePortalContainer();
  const [open, setOpen] = React.useState(false);
  const [recents, setRecents] = React.useState<string[]>(() => loadRecents());

  const initialRgba = React.useMemo(
    () => parseToRgba(value) ?? FALLBACK_RGBA,
    [value],
  );
  const [draft, setDraft] = React.useState<RGBA>(initialRgba);

  // Baseline raw input so we can revert preview on dismiss-without-change.
  const baselineRawRef = React.useRef<string>('');
  const baselineHex8Ref = React.useRef<string>(FALLBACK_HEX8);
  const draggedRef = React.useRef<boolean>(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const parsed = parseToRgba(value) ?? FALLBACK_RGBA;
      baselineRawRef.current = value;
      baselineHex8Ref.current = toHex8(parsed);
      draggedRef.current = false;
      setDraft(parsed);
      setOpen(true);
      return;
    }
    finalizeAndClose();
  };

  /** Live drag handler — never writes ChangeLog. */
  const handleSketchChange = (next: ColorResult) => {
    const rgba = colorResultToRgba(next);
    setDraft(rgba);
    draggedRef.current = true;
    onPreview?.(toHex8(rgba));
  };

  /** Commit current draft and close. */
  const commit = (rgba: RGBA) => {
    const hex8 = toHex8(rgba);
    setDraft(rgba);
    setRecents((prev) => {
      const next = pushRecent(prev, hex8);
      saveRecents(next);
      return next;
    });
    onChange(hex8);
    setOpen(false);
  };

  /** Close without explicit commit — preserve drag-then-dismiss as a commit. */
  const finalizeAndClose = () => {
    setOpen(false);
    if (draggedRef.current) {
      const finalHex8 = toHex8(draft);
      if (finalHex8 !== baselineHex8Ref.current) {
        setRecents((prev) => {
          const next = pushRecent(prev, finalHex8);
          saveRecents(next);
          return next;
        });
        onChange(finalHex8);
        return;
      }
    }
    // No effective change — revert any live preview the parent applied so
    // the host element returns to its pre-open state.
    if (onPreview && baselineRawRef.current !== value) {
      onPreview(baselineRawRef.current);
    }
  };

  const swatchBg = value && value.trim() !== '' ? value : 'transparent';
  const showChecker = !value || value.trim() === '';

  // Derive the trigger's display strings from `value`. The pill is a pure
  // mirror of the current color — hex/alpha edits happen inside the
  // popover (SketchPicker), never via separate inputs in the trigger.
  const display = React.useMemo<{ hex: string; alpha: number | null }>(() => {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return { hex: '—', alpha: null };
    const rgba = parseToRgba(trimmed);
    if (!rgba) return { hex: '—', alpha: null };
    const hex = `${toHex2(rgba.r)}${toHex2(rgba.g)}${toHex2(rgba.b)}`.toUpperCase();
    return { hex, alpha: Math.round(rgba.a * 100) };
  }, [value]);

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild disabled={disabled}>
        {triggerVariant === 'v2' ? (
          <button
            type="button"
            data-testid="paperx-color-trigger"
            aria-label={ariaLabel ?? 'Pick color'}
            className="paperx-color-trigger-v2"
          >
            <Swatch
              color={showChecker ? 'transparent' : swatchBg}
              alpha={display.alpha != null ? display.alpha / 100 : 1}
            />
            <span
              style={{
                flex: 1,
                fontSize: 'var(--dv-value-size)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
                textAlign: 'left',
                color: 'var(--dv-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {display.hex}
            </span>
            {display.alpha != null && (
              <>
                <span
                  aria-hidden
                  style={{
                    fontSize: 'var(--dv-value-size)',
                    color: 'var(--dv-text-muted)',
                  }}
                >
                  /
                </span>
                <span
                  style={{
                    fontSize: 'var(--dv-value-size)',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--dv-text-muted)',
                  }}
                >
                  {display.alpha}%
                </span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            data-testid="paperx-color-trigger"
            aria-label={ariaLabel ?? 'Pick color'}
            className={cn(
              'inline-flex h-6 min-w-[7rem] items-center gap-1.5 rounded-sm border border-input bg-white/5 px-1.5',
              'text-[11px] text-foreground transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-sm border border-white/20"
              style={{
                background: showChecker ? CHECKER_BG : undefined,
                backgroundColor: showChecker ? undefined : swatchBg,
              }}
            />
            <span className="flex-1 truncate text-left uppercase tracking-wide">
              {display.hex}
            </span>
            {display.alpha != null && (
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {display.alpha}%
              </span>
            )}
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Content
          sideOffset={8}
          align="start"
          data-testid="paperx-color-popover"
          className={cn(
            'paperx-surface pointer-events-auto',
            'z-[2147483647] rounded-lg p-2 shadow-xl outline-none',
          )}
          // Stop propagation so DesignPanel's onClick / onKeyDown handlers
          // (which guard host-page hotkeys) don't double-run.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* react-color emits its own inline styles — no global CSS injection
              into the host document. Works cleanly inside the shadow tree. */}
          <SketchPicker
            color={draft}
            onChange={handleSketchChange}
            onChangeComplete={(c) => {
              // SketchPicker fires onChangeComplete on every interaction end;
              // we treat this as a preview-promotion. Final commit happens
              // when the popover dismisses (see finalizeAndClose).
              const rgba = colorResultToRgba(c);
              setDraft(rgba);
              draggedRef.current = true;
              onPreview?.(toHex8(rgba));
            }}
            disableAlpha={false}
            // Suppress react-color's stock 15-color row — we render our
            // own Recent + Presets grids below so we control the palette.
            presetColors={[]}
            styles={{
              default: {
                picker: {
                  background: 'transparent',
                  boxShadow: 'none',
                  padding: '0',
                  width: '224px',
                  fontFamily: 'inherit',
                },
              },
            }}
          />
          {recents.length > 0 && (
            <SwatchGrid
              label="Recent"
              colors={recents}
              testIdPrefix="paperx-color-recent"
              onPick={(c) => commit(parseToRgba(c) ?? FALLBACK_RGBA)}
            />
          )}
          {presets.length > 0 && (
            <SwatchGrid
              label="Presets"
              colors={presets}
              testIdPrefix="paperx-color-preset"
              onPick={(c) => commit(parseToRgba(c) ?? FALLBACK_RGBA)}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

ColorPicker.displayName = 'ColorPicker';
