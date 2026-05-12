/**
 * Radius section — border-radius editor with an enable-on-add empty
 * state and two editing modes.
 *
 * Empty state (radius effectively unset — all four corners read 0):
 * renders only the section header — Label "Radius" + a `+` button.
 * Clicking `+` seeds all four corners with `8px` and reveals the
 * editor below. This mirrors Figma's Corner Radius panel grammar.
 *
 * Editor state — top-right toggle button (Maximize2 / Minimize2 glyph)
 * flips between:
 *   1. unified — single Slider + numeric input; applies to all four
 *      corner properties (4 separate apply() calls so ChangeLog gets
 *      4 rows, matching BoxModel link UX).
 *   2. per-corner — 4 inputs labeled with corner glyphs (TL/TR/BL/BR);
 *      each writes one corner property independently.
 *
 * Mode state is component-local. Switching modes does not commit
 * anything; user re-enters values to apply.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Maximize2, Minimize2, Plus } from 'lucide-react';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Slider } from '@/shared/ui/Slider';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { pxToInt, formatLengthPx } from '@/shared/types/numeric';

type Corner = 'tl' | 'tr' | 'br' | 'bl';

const CORNERS: ReadonlyArray<Corner> = ['tl', 'tr', 'br', 'bl'];

const CORNER_TO_PROP: Record<Corner, string> = {
  tl: 'border-top-left-radius',
  tr: 'border-top-right-radius',
  br: 'border-bottom-right-radius',
  bl: 'border-bottom-left-radius',
};

const SLIDER_MAX = 64;

function read(target: HTMLElement, prop: string): string {
  try {
    return (getComputedStyle(target).getPropertyValue(prop) ?? '').trim();
  } catch {
    return '';
  }
}

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

/**
 * Tiny inline SVG glyph indicating which corner of a square is
 * affected. Used as the prefix icon next to each per-corner input.
 */
function CornerGlyph({ corner }: { corner: Corner }): React.ReactElement {
  // All four glyphs are the same 14x14 frame; we rotate it so the
  // rounded corner lands in the requested quadrant.
  const rotation: Record<Corner, number> = { tl: 0, tr: 90, br: 180, bl: 270 };
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ transform: `rotate(${rotation[corner]}deg)` }}
      aria-hidden
    >
      <path d="M 2 12 L 2 6 A 4 4 0 0 1 6 2 L 12 2" />
    </svg>
  );
}

function broadcastAll(target: HTMLElement, styleEdit: IStyleEditService, value: string): void {
  for (const c of CORNERS) styleEdit.apply(target, CORNER_TO_PROP[c], value);
}

const DEFAULT_RADIUS_PX = '8';

export const RadiusSection = observer(({ target, styleEdit }: Props) => {
  // Seed each corner from computed style — read once per target swap.
  const seed = React.useMemo(() => {
    const out: Record<Corner, string> = { tl: '', tr: '', br: '', bl: '' };
    for (const c of CORNERS) out[c] = pxToInt(read(target, CORNER_TO_PROP[c]));
    return out;
  }, [target]);

  const [radius, setRadius] = React.useState<Record<Corner, string>>(seed);
  const [mode, setMode] = React.useState<'unified' | 'per-corner'>('unified');

  React.useEffect(() => setRadius(seed), [seed]);

  // Unified value: when all corners agree show that number, else blank.
  const allEqual = radius.tl !== '' && radius.tl === radius.tr && radius.tr === radius.br && radius.br === radius.bl;
  const unifiedValue = allEqual ? radius.tl : '';
  const unifiedNumber = unifiedValue === '' ? 0 : Math.min(SLIDER_MAX, Number(unifiedValue) || 0);

  // "Enabled" — at least one corner has a non-zero radius. We treat
  // 0 / '' uniformly as the empty state so the user can opt back in
  // via the `+` button after explicitly removing all rounding.
  const enabled = CORNERS.some((c) => {
    const v = radius[c];
    return v !== '' && Number(v) > 0;
  });

  const commitUnified = (raw: string) => {
    setRadius({ tl: raw, tr: raw, br: raw, bl: raw });
    if (raw.trim() === '') return;
    const formatted = formatLengthPx(raw, { allowNegative: false });
    if (formatted == null) return;
    broadcastAll(target, styleEdit, formatted);
  };

  const commitCorner = (corner: Corner, raw: string) => {
    setRadius((prev) => ({ ...prev, [corner]: raw }));
    if (raw.trim() === '') return;
    const formatted = formatLengthPx(raw, { allowNegative: false });
    if (formatted == null) return;
    styleEdit.apply(target, CORNER_TO_PROP[corner], formatted);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="normal-case tracking-normal">Radius</Label>
        {enabled ? (
          <button
            type="button"
            data-testid="paperx-radius-mode-toggle"
            onClick={() => setMode((m) => (m === 'unified' ? 'per-corner' : 'unified'))}
            aria-pressed={mode === 'per-corner'}
            title={mode === 'unified' ? 'Switch to per-corner' : 'Switch to unified'}
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {mode === 'unified' ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </button>
        ) : (
          <button
            type="button"
            data-testid="paperx-radius-add"
            onClick={() => commitUnified(DEFAULT_RADIUS_PX)}
            aria-label="Enable radius"
            title="Enable radius (8px)"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {!enabled ? null : mode === 'unified' ? (
        <div className="flex items-center gap-2" data-testid="paperx-radius-unified">
          <div className="flex-1">
            <Slider
              value={unifiedNumber}
              min={0}
              max={SLIDER_MAX}
              step={1}
              ariaLabel="Border radius"
              onPreview={(v) => commitUnified(String(v))}
              onChange={(v) => commitUnified(String(v))}
              data-testid="paperx-radius-unified-slider"
            />
          </div>
          <Input
            data-testid="paperx-radius-unified-input"
            type="text"
            inputMode="numeric"
            value={unifiedValue}
            placeholder="0"
            onChange={(e) => commitUnified(e.currentTarget.value)}
            className="h-6 w-14 px-1 text-center text-[11px]"
          />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5" data-testid="paperx-radius-per-corner">
          {CORNERS.map((c) => (
            <div
              key={c}
              className="flex items-center gap-1 rounded-sm border border-input bg-white/5 px-1.5"
            >
              <span className="text-muted-foreground">
                <CornerGlyph corner={c} />
              </span>
              <Input
                data-testid={`paperx-radius-${c}`}
                type="text"
                inputMode="numeric"
                value={radius[c]}
                placeholder="0"
                onChange={(e) => commitCorner(c, e.currentTarget.value)}
                className="h-6 w-full border-0 bg-transparent px-0 text-[11px] focus-visible:ring-0"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
RadiusSection.displayName = 'RadiusSection';
