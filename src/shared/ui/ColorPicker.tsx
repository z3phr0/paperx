/**
 * ColorPicker — Figma-style swatch trigger + Radix Popover + react-colorful
 * picker. First production consumer of <PortalProvider> (Phase 2 P0-1).
 *
 * Design contract (S2-C):
 *
 *   1. The popover MUST mount inside the shadow tree via
 *      `<Popover.Portal container={usePortalContainer()}>`. Without that
 *      container prop, Radix portals to `document.body`, the host page's
 *      CSS bleeds in, and our scoped Tailwind tokens won't apply. The
 *      whole `paperx-portal-layer` plumbing exists for this exact use.
 *
 *   2. Live preview vs commit are split into two callbacks:
 *        - `onPreview(hex)`  — fires every drag frame; the parent should
 *          mutate the live element directly (no ChangeLog write)
 *        - `onChange(hex)`   — fires once on Apply / close-with-changes;
 *          the parent should call `StyleEditService.apply` so ChangeLog
 *          gets exactly ONE record per pick session, not one per frame.
 *
 *   3. react-colorful's <style> auto-injection points at
 *      `ref.current.ownerDocument` which, for nodes inside a Shadow DOM,
 *      is the *host* document — not the shadow root. So the injected
 *      stylesheet lands in `<head>` and never crosses the shadow
 *      boundary. We work around this by inlining the (small) library CSS
 *      into the popover content itself, where it lives inside the shadow
 *      tree by virtue of `paperx-portal-layer` being a shadow child.
 *
 *   4. Recent colors persist in sessionStorage under `paperx.recentColors`
 *      (LRU, max 8). Read/write failures fall back to a module-level
 *      array so the picker still works in restricted contexts.
 */
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { HexColorPicker, HexColorInput } from 'react-colorful';

import { usePortalContainer } from '@/shared/ui/portal';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/utils';

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
}

// ---------------------------------------------------------------------------
// Hex normalization
// ---------------------------------------------------------------------------

const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;
const HEX8 = /^#([0-9a-f]{8})$/i; // strip alpha — out of scope this sprint
const RGB = /^rgba?\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*(?:,\s*(-?\d*\.?\d+)\s*)?\)$/i;

const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  transparent: '#000000',
};

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex2(n: number): string {
  return clamp255(n).toString(16).padStart(2, '0');
}

/**
 * Best-effort parse of any CSS color string into `#rrggbb` (lowercase).
 * Returns `null` when the value is not parseable; callers fall back to a
 * sensible default rather than ever passing `null` to react-colorful.
 */
export function parseToHex(input: string): string | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (!v) return null;

  let m = HEX6.exec(v);
  if (m) return `#${m[1]!.toLowerCase()}`;

  m = HEX3.exec(v);
  if (m) {
    const s = m[1]!;
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toLowerCase();
  }

  m = HEX8.exec(v);
  if (m) return `#${m[1]!.slice(0, 6).toLowerCase()}`;

  m = RGB.exec(v);
  if (m) {
    return `#${toHex2(Number(m[1]))}${toHex2(Number(m[2]))}${toHex2(Number(m[3]))}`;
  }

  if (v in NAMED_COLORS) return NAMED_COLORS[v]!;
  return null;
}

const FALLBACK_HEX = '#000000';

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
    // sessionStorage unavailable / quota — memoryRecents already updated.
  }
}

function pushRecent(prev: string[], hex: string): string[] {
  const norm = hex.toLowerCase();
  const filtered = prev.filter((c) => c.toLowerCase() !== norm);
  return [norm, ...filtered].slice(0, RECENTS_MAX);
}

// ---------------------------------------------------------------------------
// Inlined react-colorful CSS — see header note (3) for rationale
// ---------------------------------------------------------------------------
//
// Source: copied verbatim from
//   node_modules/react-colorful/dist/index.module.js (the `Q` hook). The
// upstream injects this into the host document's <head>; we re-render it
// here so it lands inside the shadow tree alongside the picker DOM.
const REACT_COLORFUL_CSS = `
.react-colorful{position:relative;display:flex;flex-direction:column;width:200px;height:200px;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;cursor:default}
.react-colorful__saturation{position:relative;flex-grow:1;border-color:transparent;border-bottom:12px solid #000;border-radius:8px 8px 0 0;background-image:linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsla(0,0%,100%,0))}
.react-colorful__alpha-gradient,.react-colorful__pointer-fill{content:"";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;border-radius:inherit}
.react-colorful__alpha-gradient,.react-colorful__saturation{box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}
.react-colorful__alpha,.react-colorful__hue{position:relative;height:24px}
.react-colorful__hue{background:linear-gradient(90deg,red 0,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,red)}
.react-colorful__last-control{border-radius:0 0 8px 8px}
.react-colorful__interactive{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;outline:none;touch-action:none}
.react-colorful__pointer{position:absolute;z-index:1;box-sizing:border-box;width:28px;height:28px;transform:translate(-50%,-50%);background-color:#fff;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.2)}
.react-colorful__interactive:focus .react-colorful__pointer{transform:translate(-50%,-50%) scale(1.1)}
.react-colorful__alpha,.react-colorful__alpha-pointer{background-color:#fff;background-image:url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><path d="M8 0h8v8H8zM0 8h8v8H0z"/></svg>')}
.react-colorful__saturation-pointer{z-index:3}
.react-colorful__hue-pointer{z-index:2}
`;

// Transparent checkerboard for the trigger swatch when value is empty.
const CHECKER_BG =
  "url(\"data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><rect width='6' height='6' fill='%23ccc'/><rect x='6' y='6' width='6' height='6' fill='%23ccc'/></svg>\")";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColorPicker({
  value,
  onChange,
  onPreview,
  disabled,
  ariaLabel,
}: ColorPickerProps): React.ReactElement {
  const portalContainer = usePortalContainer();
  const [open, setOpen] = React.useState(false);
  const [recents, setRecents] = React.useState<string[]>(() => loadRecents());

  // baselineHex captures the parsed-hex form of `value` at popover open
  // time. We compare on close to decide whether the user actually picked
  // something, since live preview means the parent's `value` may have
  // already moved. baselineRawValue retains the original CSS string so
  // the parent can be reverted (via onPreview) if the user bailed.
  const baselineHexRef = React.useRef<string>(FALLBACK_HEX);
  const baselineRawRef = React.useRef<string>('');
  const draggedRef = React.useRef<boolean>(false);

  const initialHex = React.useMemo(
    () => parseToHex(value) ?? FALLBACK_HEX,
    [value],
  );
  const [draftHex, setDraftHex] = React.useState<string>(initialHex);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const parsed = parseToHex(value) ?? FALLBACK_HEX;
      baselineHexRef.current = parsed;
      baselineRawRef.current = value;
      draggedRef.current = false;
      setDraftHex(parsed);
      setOpen(true);
      return;
    }
    // Closing — Radix calls this for ESC, outside-click, and our own
    // Apply button. Decide whether to commit, revert, or no-op.
    finalizeAndClose();
  };

  /** Live drag handler — never writes ChangeLog. */
  const handleDrag = (hex: string) => {
    const norm = hex.toLowerCase();
    setDraftHex(norm);
    draggedRef.current = true;
    onPreview?.(norm);
  };

  /** Commit current draft and close. Used by Apply button + recent-color clicks. */
  const commit = (hex: string) => {
    const norm = hex.toLowerCase();
    setDraftHex(norm);
    setRecents((prev) => {
      const next = pushRecent(prev, norm);
      saveRecents(next);
      return next;
    });
    onChange(norm);
    setOpen(false);
  };

  /** Close without explicit commit — decide based on whether user dragged. */
  const finalizeAndClose = () => {
    setOpen(false);
    if (draggedRef.current) {
      // Treat drag-then-dismiss as commit — preserve user intent.
      const finalHex = draftHex;
      if (finalHex.toLowerCase() !== baselineHexRef.current.toLowerCase()) {
        setRecents((prev) => {
          const next = pushRecent(prev, finalHex);
          saveRecents(next);
          return next;
        });
        onChange(finalHex.toLowerCase());
        return;
      }
    }
    // No effective change — revert any live preview the parent applied
    // so the host element returns to its pre-open state.
    if (onPreview && baselineRawRef.current !== value) {
      onPreview(baselineRawRef.current);
    }
  };

  const swatchBg = value && value.trim() !== '' ? value : 'transparent';
  const showChecker = !value || value.trim() === '';

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={ariaLabel ?? 'Pick color'}
          className={cn(
            'relative h-6 w-6 shrink-0 rounded-sm border border-input',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          style={{
            background: showChecker ? CHECKER_BG : undefined,
            backgroundColor: showChecker ? undefined : swatchBg,
          }}
        >
          {/* Bottom-right caret hint. */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 border-l-[5px] border-t-[5px] border-l-transparent border-t-transparent border-r-[5px] border-b-[5px] border-r-white border-b-white drop-shadow"
            style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,.4))' }}
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Content
          sideOffset={8}
          align="start"
          className={cn(
            'z-[2147483647] w-[232px] rounded-lg border bg-background p-3 shadow-md',
            'text-foreground outline-none',
          )}
          // Stop propagation so DesignPanel's onClick / onKeyDown handlers
          // (which stop host-page hotkeys) don't double-run.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* react-colorful CSS, scoped into the shadow tree via this node. */}
          <style>{REACT_COLORFUL_CSS}</style>
          <HexColorPicker
            color={draftHex}
            onChange={handleDrag}
            style={{ width: '100%', height: '160px' }}
          />
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">#</span>
            <HexColorInput
              color={draftHex.replace(/^#/, '')}
              onChange={(raw) => {
                // HexColorInput already validates — only commit to draft
                // when the result is a full hex.
                const next = `#${raw}`.toLowerCase();
                if (HEX6.test(next) || HEX3.test(next)) {
                  const hex = parseToHex(next) ?? FALLBACK_HEX;
                  setDraftHex(hex);
                  draggedRef.current = true;
                  onPreview?.(hex);
                }
              }}
              className={cn(
                'flex h-7 w-full rounded-sm border border-input bg-background px-2 py-1 text-xs',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
            />
          </div>
          {recents.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Recent
              </div>
              <div className="grid grid-cols-4 gap-1">
                {recents.map((c, i) => (
                  <button
                    key={`${c}-${i}`}
                    type="button"
                    aria-label={`Apply ${c}`}
                    onClick={() => commit(c)}
                    className={cn(
                      'h-5 w-full rounded-sm border border-input',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={() => commit(draftHex)}
              type="button"
            >
              Apply
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

ColorPicker.displayName = 'ColorPicker';
