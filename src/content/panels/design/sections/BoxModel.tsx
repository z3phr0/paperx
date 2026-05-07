/**
 * BoxModel section — Figma-style nested-rectangle visualization that
 * combines what used to be three separate sections (Size / Spacing /
 * Position) into one panel.
 *
 * Visual hierarchy (outer → inner):
 *   ┌─ MARGIN ──────────────────────────┐
 *   │   ┌─ (border placeholder) ────┐    │
 *   │   │   ┌─ PADDING ────────┐    │    │
 *   │   │   │  W × H (center)  │    │    │
 *   │   │   └──────────────────┘    │    │
 *   │   └────────────────────────────┘    │
 *   └─────────────────────────────────────┘
 *   Position offsets (top/right/bottom/left) — shown below the box.
 *
 * Writes flow ONLY through StyleEditService.apply so ChangeLog and
 * JsonPromptExporter capture every edit. Linked toggles broadcast to
 * all four sides via four separate apply() calls (one ChangeLog row
 * per side — matches the Figma "constrain" UX).
 *
 * Hooks-order rule: every useState/useEffect runs BEFORE any early
 * return. The component is rendered by DesignPanel only when target
 * is non-null, but we still treat target defensively to keep React's
 * hook order stable across renders.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { pxToInt, formatLengthPx } from '@/shared/types/numeric';

type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'] as const;

function read(target: HTMLElement, prop: string): string {
  // Read seed values via getComputedStyle only — the StyleEditService
  // owns inline mutations, so we never reach into target.style here.
  try {
    return getComputedStyle(target).getPropertyValue(prop) ?? '';
  } catch {
    return '';
  }
}

const strip = pxToInt;
const formatLength = (raw: string, allowNegative: boolean) =>
  formatLengthPx(raw, { allowNegative });

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const BoxModelSection = observer(({ target, styleEdit }: Props) => {
  // ─── Size (W / H) ──────────────────────────────────────────────────
  const widthSeed = React.useMemo(() => strip(read(target, 'width')), [target]);
  const heightSeed = React.useMemo(() => strip(read(target, 'height')), [target]);
  const [width, setWidth] = React.useState(widthSeed);
  const [height, setHeight] = React.useState(heightSeed);
  React.useEffect(() => setWidth(widthSeed), [widthSeed]);
  React.useEffect(() => setHeight(heightSeed), [heightSeed]);

  // ─── Padding (4 sides + link toggle) ───────────────────────────────
  const paddingSeed = React.useMemo(
    () =>
      SIDES.map((s) => strip(read(target, `padding-${s}`))) as [
        string,
        string,
        string,
        string,
      ],
    [target],
  );
  const [padding, setPadding] = React.useState(paddingSeed);
  const [paddingLinked, setPaddingLinked] = React.useState(false);
  React.useEffect(() => setPadding(paddingSeed), [paddingSeed]);

  // ─── Margin (4 sides + link toggle) ────────────────────────────────
  const marginSeed = React.useMemo(
    () =>
      SIDES.map((s) => strip(read(target, `margin-${s}`))) as [
        string,
        string,
        string,
        string,
      ],
    [target],
  );
  const [margin, setMargin] = React.useState(marginSeed);
  const [marginLinked, setMarginLinked] = React.useState(false);
  React.useEffect(() => setMargin(marginSeed), [marginSeed]);

  // ─── Position offsets (top/right/bottom/left) ──────────────────────
  const positionSeed = React.useMemo(
    () => Object.fromEntries(SIDES.map((s) => [s, strip(read(target, s))])) as Record<Side, string>,
    [target],
  );
  const [position, setPosition] = React.useState(positionSeed);
  React.useEffect(() => setPosition(positionSeed), [positionSeed]);

  // ─── Commit helpers ────────────────────────────────────────────────
  const commitSize = (prop: 'width' | 'height', raw: string) => {
    if (prop === 'width') setWidth(raw);
    else setHeight(raw);
    if (raw.trim() === '') return;
    const formatted = formatLength(raw, false);
    if (formatted == null) return;
    styleEdit.apply(target, prop, formatted);
  };

  const commitPadding = (idx: number, raw: string) => {
    const next: [string, string, string, string] = paddingLinked
      ? [raw, raw, raw, raw]
      : ([...padding.slice(0, idx), raw, ...padding.slice(idx + 1)] as [
          string,
          string,
          string,
          string,
        ]);
    setPadding(next);
    if (raw.trim() === '') return;
    const formatted = formatLength(raw, false);
    if (formatted == null) return;
    if (paddingLinked) {
      SIDES.forEach((s) => styleEdit.apply(target, `padding-${s}`, formatted));
    } else {
      const side = SIDES[idx]!;
      styleEdit.apply(target, `padding-${side}`, formatted);
    }
  };

  const commitMargin = (idx: number, raw: string) => {
    const next: [string, string, string, string] = marginLinked
      ? [raw, raw, raw, raw]
      : ([...margin.slice(0, idx), raw, ...margin.slice(idx + 1)] as [
          string,
          string,
          string,
          string,
        ]);
    setMargin(next);
    if (raw.trim() === '') return;
    const formatted = formatLength(raw, true);
    if (formatted == null) return;
    if (marginLinked) {
      SIDES.forEach((s) => styleEdit.apply(target, `margin-${s}`, formatted));
    } else {
      const side = SIDES[idx]!;
      styleEdit.apply(target, `margin-${side}`, formatted);
    }
  };

  const commitPosition = (side: Side, raw: string) => {
    setPosition((prev) => ({ ...prev, [side]: raw }));
    if (raw.trim() === '') return;
    const formatted = formatLength(raw, true);
    if (formatted == null) return;
    styleEdit.apply(target, side, formatted);
  };

  // Tiny consistent class for the edge inputs inside the nested boxes.
  const edgeInput =
    'h-5 w-10 rounded-sm border border-input bg-background px-1 text-center text-[10px]';

  return (
    <div className="flex flex-col gap-2">
      {/* ───── BOX-MODEL VISUALIZATION ───── */}
      <div className="relative rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 p-1 pt-4">
        <div className="absolute left-2 top-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          Margin
        </div>
        <button
          type="button"
          data-testid="paperx-boxmodel-link-margin"
          onClick={() => setMarginLinked((v) => !v)}
          aria-pressed={marginLinked}
          title={marginLinked ? 'Unlink margin sides' : 'Link margin sides'}
          className="absolute right-1 top-0.5 text-[9px] text-muted-foreground hover:text-foreground"
        >
          {marginLinked ? 'linked' : 'free'}
        </button>

        {/* Margin: top */}
        <div className="flex justify-center">
          <Input
            type="text"
            inputMode="numeric"
            data-testid="paperx-boxmodel-mt"
            value={margin[0]}
            placeholder="0"
            onChange={(e) => commitMargin(0, e.target.value)}
            className={edgeInput}
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Margin: left */}
          <Input
            type="text"
            inputMode="numeric"
            data-testid="paperx-boxmodel-ml"
            value={margin[3]}
            placeholder="0"
            onChange={(e) => commitMargin(3, e.target.value)}
            className={edgeInput}
          />

          {/* Border placeholder ring + padding ring + size cell */}
          <div className="relative flex-1 rounded-md border border-dashed border-muted-foreground/30 bg-background/40 p-1 pt-3.5">
            <div className="absolute left-1.5 top-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Padding
            </div>
            <button
              type="button"
              data-testid="paperx-boxmodel-link-padding"
              onClick={() => setPaddingLinked((v) => !v)}
              aria-pressed={paddingLinked}
              title={paddingLinked ? 'Unlink padding sides' : 'Link padding sides'}
              className="absolute right-1 top-0.5 text-[9px] text-muted-foreground hover:text-foreground"
            >
              {paddingLinked ? 'linked' : 'free'}
            </button>

            {/* Padding: top */}
            <div className="flex justify-center">
              <Input
                type="text"
                inputMode="numeric"
                data-testid="paperx-boxmodel-pt"
                value={padding[0]}
                placeholder="0"
                onChange={(e) => commitPadding(0, e.target.value)}
                className={edgeInput}
              />
            </div>

            <div className="flex items-center gap-1">
              {/* Padding: left */}
              <Input
                type="text"
                inputMode="numeric"
                data-testid="paperx-boxmodel-pl"
                value={padding[3]}
                placeholder="0"
                onChange={(e) => commitPadding(3, e.target.value)}
                className={edgeInput}
              />

              {/* Center cell — Size (W × H) */}
              <div className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-input bg-muted/40 px-1 py-2">
                <span className="text-[10px] font-semibold text-foreground">
                  {"W"}
                </span>
                <Input
                  type="number"
                  data-testid="paperx-boxmodel-w"
                  value={width}
                  placeholder="auto"
                  onChange={(e) => commitSize('width', e.target.value)}
                  className="h-5 w-12 px-1 text-center text-[10px]"
                />
                <span className="text-[10px] font-semibold text-foreground">
                  {"H"}
                </span>
                <Input
                  type="number"
                  data-testid="paperx-boxmodel-h"
                  value={height}
                  placeholder="auto"
                  onChange={(e) => commitSize('height', e.target.value)}
                  className="h-5 w-12 px-1 text-center text-[10px]"
                />
              </div>

              {/* Padding: right */}
              <Input
                type="text"
                inputMode="numeric"
                data-testid="paperx-boxmodel-pr"
                value={padding[1]}
                placeholder="0"
                onChange={(e) => commitPadding(1, e.target.value)}
                className={edgeInput}
              />
            </div>

            {/* Padding: bottom */}
            <div className="flex justify-center">
              <Input
                type="text"
                inputMode="numeric"
                data-testid="paperx-boxmodel-pb"
                value={padding[2]}
                placeholder="0"
                onChange={(e) => commitPadding(2, e.target.value)}
                className={edgeInput}
              />
            </div>
          </div>

          {/* Margin: right */}
          <Input
            type="text"
            inputMode="numeric"
            data-testid="paperx-boxmodel-mr"
            value={margin[1]}
            placeholder="0"
            onChange={(e) => commitMargin(1, e.target.value)}
            className={edgeInput}
          />
        </div>

        {/* Margin: bottom */}
        <div className="flex justify-center">
          <Input
            type="text"
            inputMode="numeric"
            data-testid="paperx-boxmodel-mb"
            value={margin[2]}
            placeholder="0"
            onChange={(e) => commitMargin(2, e.target.value)}
            className={edgeInput}
          />
        </div>
      </div>

      {/* ───── POSITION OFFSETS ───── */}
      <div className="flex flex-col gap-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Position
        </div>
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1">
            <span className="w-10 text-[10px] text-muted-foreground">top</span>
            <Input
              type="text"
              inputMode="numeric"
              data-testid="paperx-boxmodel-top"
              value={position.top}
              placeholder="auto"
              onChange={(e) => commitPosition('top', e.target.value)}
              className="h-6 flex-1 px-1 text-[10px]"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="w-10 text-[10px] text-muted-foreground">right</span>
            <Input
              type="text"
              inputMode="numeric"
              data-testid="paperx-boxmodel-right"
              value={position.right}
              placeholder="auto"
              onChange={(e) => commitPosition('right', e.target.value)}
              className="h-6 flex-1 px-1 text-[10px]"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="w-10 text-[10px] text-muted-foreground">bottom</span>
            <Input
              type="text"
              inputMode="numeric"
              data-testid="paperx-boxmodel-bottom"
              value={position.bottom}
              placeholder="auto"
              onChange={(e) => commitPosition('bottom', e.target.value)}
              className="h-6 flex-1 px-1 text-[10px]"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="w-10 text-[10px] text-muted-foreground">left</span>
            <Input
              type="text"
              inputMode="numeric"
              data-testid="paperx-boxmodel-left"
              value={position.left}
              placeholder="auto"
              onChange={(e) => commitPosition('left', e.target.value)}
              className="h-6 flex-1 px-1 text-[10px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
BoxModelSection.displayName = 'BoxModelSection';
