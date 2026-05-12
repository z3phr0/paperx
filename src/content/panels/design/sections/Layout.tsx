/**
 * Layout section — Framer-style Stack (flexbox) + Grid editor.
 *
 * Type segmented sets `display: flex` (Stack) or `display: grid` (Grid).
 * When the host element has neither, the picker defaults visually to
 * Stack but no `display` is written until the user clicks Type or
 * touches a sub-control.
 *
 * Stack mode controls: Direction, Distribute, Align, Wrap, Gap, Padding.
 * Grid mode controls:  Masonry, Columns, Gap X/Y, Padding.
 *
 * Padding has a uniform / per-side toggle (Figma-style). Uniform writes
 * the `padding` shorthand; per-side writes the four longhands so the
 * BoxModel section's reads stay consistent.
 *
 * Hooks-order discipline: every `useState` / `useMemo` / `useEffect`
 * runs before any conditional render. CLAUDE.md line 56 — violating
 * this caused a real bug, the layout-mode e2e test guarded it before
 * that mode was deleted.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import {
  ArrowDown,
  ArrowRight,
  Maximize2,
  Minus,
  Plus,
  Square,
} from 'lucide-react';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Segmented, type SegmentedOption } from '@/shared/ui/Segmented';
import { Slider } from '@/shared/ui/Slider';
import { IconButton } from '@/shared/ui/IconButton';
import { cn } from '@/shared/ui/utils';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

type LayoutType = 'stack' | 'grid';
type FlexDirection = 'row' | 'column';
type WrapValue = 'wrap' | 'nowrap';
type AlignItems = 'flex-start' | 'center' | 'flex-end';
type JustifyContent =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
type Masonry = 'yes' | 'no';
type PaddingMode = 'uniform' | 'per-side';

const TYPE_OPTIONS: ReadonlyArray<SegmentedOption<LayoutType>> = [
  { value: 'stack', label: <span data-testid="paperx-layout-type-stack">Stack</span> },
  { value: 'grid', label: <span data-testid="paperx-layout-type-grid">Grid</span> },
];

const DIRECTION_OPTIONS: ReadonlyArray<SegmentedOption<FlexDirection>> = [
  {
    value: 'row',
    ariaLabel: 'Horizontal',
    label: (
      <span data-testid="paperx-layout-direction-row" className="inline-flex">
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </span>
    ),
  },
  {
    value: 'column',
    ariaLabel: 'Vertical',
    label: (
      <span data-testid="paperx-layout-direction-column" className="inline-flex">
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      </span>
    ),
  },
];

const WRAP_OPTIONS: ReadonlyArray<SegmentedOption<WrapValue>> = [
  { value: 'wrap', label: <span data-testid="paperx-layout-wrap-yes">Yes</span> },
  { value: 'nowrap', label: <span data-testid="paperx-layout-wrap-no">No</span> },
];

const MASONRY_OPTIONS: ReadonlyArray<SegmentedOption<Masonry>> = [
  { value: 'yes', label: <span data-testid="paperx-layout-masonry-yes">Yes</span> },
  { value: 'no', label: <span data-testid="paperx-layout-masonry-no">No</span> },
];

const DISTRIBUTE_OPTIONS: ReadonlyArray<{ value: JustifyContent; label: string }> = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'space-between', label: 'Space between' },
  { value: 'space-around', label: 'Space around' },
  { value: 'space-evenly', label: 'Space evenly' },
];

const ALIGN_ENTRIES: ReadonlyArray<{ value: AlignItems; label: string }> = [
  { value: 'flex-start', label: 'Align start' },
  { value: 'center', label: 'Align center' },
  { value: 'flex-end', label: 'Align end' },
];

function read(target: HTMLElement, prop: string): string {
  try {
    return (getComputedStyle(target).getPropertyValue(prop) ?? '').trim();
  } catch {
    return '';
  }
}

/** Strip 'px' suffix and round; '0' or '' both render as empty in inputs. */
function pxNum(raw: string): string {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return '';
  return n === 0 ? '0' : String(n);
}

function detectType(target: HTMLElement): LayoutType | null {
  const d = read(target, 'display');
  if (d === 'flex' || d === 'inline-flex') return 'stack';
  if (d === 'grid' || d === 'inline-grid') return 'grid';
  return null;
}

function detectColumns(target: HTMLElement): string {
  // Best-effort parse of `grid-template-columns: repeat(N, 1fr)` —
  // the only shape we generate. Anything fancier (named lines, mixed
  // tracks) falls back to the column count from getComputedStyle's
  // expansion.
  const inline = target.style.getPropertyValue('grid-template-columns').trim();
  const m = inline.match(/^repeat\(\s*(\d+)/i);
  if (m) return m[1]!;
  const computed = read(target, 'grid-template-columns');
  if (!computed || computed === 'none') return '';
  return String(computed.split(/\s+/).filter(Boolean).length);
}

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const LayoutSection = observer(({ target, styleEdit }: Props) => {
  // === Hooks (all before any conditional render) =========================

  // Seed values — recomputed when target changes.
  const seedType = React.useMemo<LayoutType>(() => detectType(target) ?? 'stack', [target]);
  const seedDirection = React.useMemo<FlexDirection>(() => {
    const v = read(target, 'flex-direction');
    return v === 'column' || v === 'column-reverse' ? 'column' : 'row';
  }, [target]);
  const seedWrap = React.useMemo<WrapValue>(() => {
    const v = read(target, 'flex-wrap');
    return v === 'wrap' || v === 'wrap-reverse' ? 'wrap' : 'nowrap';
  }, [target]);
  const seedAlign = React.useMemo<AlignItems>(() => {
    const v = read(target, 'align-items');
    if (v === 'flex-start' || v === 'start') return 'flex-start';
    if (v === 'flex-end' || v === 'end') return 'flex-end';
    return 'center';
  }, [target]);
  const seedDistribute = React.useMemo<JustifyContent>(() => {
    const v = read(target, 'justify-content');
    const allowed: JustifyContent[] = [
      'flex-start',
      'center',
      'flex-end',
      'space-between',
      'space-around',
      'space-evenly',
    ];
    return (allowed as string[]).includes(v) ? (v as JustifyContent) : 'flex-start';
  }, [target]);
  const seedGap = React.useMemo(() => pxNum(read(target, 'gap')), [target]);
  const seedGapX = React.useMemo(() => pxNum(read(target, 'column-gap')), [target]);
  const seedGapY = React.useMemo(() => pxNum(read(target, 'row-gap')), [target]);
  const seedColumns = React.useMemo(() => detectColumns(target), [target]);
  const seedMasonry = React.useMemo<Masonry>(
    () => (read(target, 'grid-template-rows').includes('masonry') ? 'yes' : 'no'),
    [target],
  );
  const seedPadding = React.useMemo(
    () => ({
      top: pxNum(read(target, 'padding-top')),
      right: pxNum(read(target, 'padding-right')),
      bottom: pxNum(read(target, 'padding-bottom')),
      left: pxNum(read(target, 'padding-left')),
    }),
    [target],
  );
  const seedPaddingMode = React.useMemo<PaddingMode>(() => {
    const all =
      seedPadding.top === seedPadding.right &&
      seedPadding.right === seedPadding.bottom &&
      seedPadding.bottom === seedPadding.left;
    return all ? 'uniform' : 'per-side';
  }, [seedPadding]);

  // Local controlled state — re-syncs on target change via effects.
  const [type, setType] = React.useState<LayoutType>(seedType);
  const [direction, setDirection] = React.useState<FlexDirection>(seedDirection);
  const [wrap, setWrap] = React.useState<WrapValue>(seedWrap);
  const [align, setAlign] = React.useState<AlignItems>(seedAlign);
  const [distribute, setDistribute] = React.useState<JustifyContent>(seedDistribute);
  const [gap, setGap] = React.useState(seedGap);
  const [gapX, setGapX] = React.useState(seedGapX);
  const [gapY, setGapY] = React.useState(seedGapY);
  const [columns, setColumns] = React.useState(seedColumns);
  const [masonry, setMasonry] = React.useState<Masonry>(seedMasonry);
  const [padding, setPadding] = React.useState(seedPadding);
  const [paddingMode, setPaddingMode] = React.useState<PaddingMode>(seedPaddingMode);

  React.useEffect(() => setType(seedType), [seedType]);
  React.useEffect(() => setDirection(seedDirection), [seedDirection]);
  React.useEffect(() => setWrap(seedWrap), [seedWrap]);
  React.useEffect(() => setAlign(seedAlign), [seedAlign]);
  React.useEffect(() => setDistribute(seedDistribute), [seedDistribute]);
  React.useEffect(() => setGap(seedGap), [seedGap]);
  React.useEffect(() => setGapX(seedGapX), [seedGapX]);
  React.useEffect(() => setGapY(seedGapY), [seedGapY]);
  React.useEffect(() => setColumns(seedColumns), [seedColumns]);
  React.useEffect(() => setMasonry(seedMasonry), [seedMasonry]);
  React.useEffect(() => setPadding(seedPadding), [seedPadding]);
  React.useEffect(() => setPaddingMode(seedPaddingMode), [seedPaddingMode]);

  // === Writers ===========================================================

  const writeDisplay = (next: LayoutType) => {
    styleEdit.apply(target, 'display', next === 'stack' ? 'flex' : 'grid');
  };

  const handleTypeChange = (next: LayoutType) => {
    setType(next);
    writeDisplay(next);
  };

  const writeGap = (raw: string) => {
    setGap(raw);
    if (raw.trim() === '') return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    styleEdit.apply(target, 'gap', `${n}px`);
  };

  const writeGapXY = (axis: 'x' | 'y', raw: string) => {
    if (axis === 'x') setGapX(raw);
    else setGapY(raw);
    if (raw.trim() === '') return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    styleEdit.apply(target, axis === 'x' ? 'column-gap' : 'row-gap', `${n}px`);
  };

  const writeColumns = (raw: string) => {
    setColumns(raw);
    if (raw.trim() === '') return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return;
    styleEdit.apply(target, 'grid-template-columns', `repeat(${n}, 1fr)`);
  };

  const bumpColumns = (delta: 1 | -1) => {
    const cur = parseInt(columns, 10);
    const base = Number.isFinite(cur) ? cur : 1;
    writeColumns(String(Math.max(1, base + delta)));
  };

  const writeMasonry = (next: Masonry) => {
    setMasonry(next);
    styleEdit.apply(target, 'grid-template-rows', next === 'yes' ? 'masonry' : '');
  };

  const writeUniformPadding = (raw: string) => {
    setPadding({ top: raw, right: raw, bottom: raw, left: raw });
    if (raw.trim() === '') return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    styleEdit.apply(target, 'padding', `${n}px`);
  };

  const writePaddingSide = (side: 'top' | 'right' | 'bottom' | 'left', raw: string) => {
    setPadding((prev) => ({ ...prev, [side]: raw }));
    if (raw.trim() === '') return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    styleEdit.apply(target, `padding-${side}`, `${n}px`);
  };

  // === Render ============================================================

  const fieldRow = 'flex items-center gap-2';
  const labelCol = 'w-16 shrink-0 normal-case tracking-normal';

  return (
    <div className="flex flex-col gap-2" data-testid="paperx-layout">
      <div className={fieldRow}>
        <Label className={labelCol}>Type</Label>
        <Segmented<LayoutType> value={type} onChange={handleTypeChange} options={TYPE_OPTIONS} />
      </div>

      {type === 'stack' && (
        <>
          <div className={fieldRow}>
            <Label className={labelCol}>Direction</Label>
            <Segmented<FlexDirection>
              value={direction}
              onChange={(v) => {
                setDirection(v);
                styleEdit.apply(target, 'flex-direction', v);
              }}
              options={DIRECTION_OPTIONS}
            />
          </div>

          <div className={fieldRow}>
            <Label className={labelCol}>Distribute</Label>
            <select
              data-testid="paperx-layout-distribute"
              value={distribute}
              onChange={(e) => {
                const v = e.currentTarget.value as JustifyContent;
                setDistribute(v);
                styleEdit.apply(target, 'justify-content', v);
              }}
              className="h-7 flex-1 rounded-md border border-input bg-secondary px-2 text-xs"
            >
              {DISTRIBUTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className={fieldRow}>
            <Label className={labelCol}>Align</Label>
            <div className="inline-flex items-center gap-1">
              {ALIGN_ENTRIES.map(({ value: v, label }) => (
                <IconButton
                  key={v}
                  ariaLabel={label}
                  active={align === v}
                  data-testid={`paperx-layout-align-${v}`}
                  size="sm"
                  onClick={() => {
                    setAlign(v);
                    styleEdit.apply(target, 'align-items', v);
                  }}
                >
                  <span
                    className={cn(
                      'inline-block h-3 w-3 rounded-sm bg-current',
                      v === 'flex-start' && 'self-start',
                      v === 'center' && 'self-center',
                      v === 'flex-end' && 'self-end',
                    )}
                    aria-hidden
                  />
                </IconButton>
              ))}
            </div>
          </div>

          <div className={fieldRow}>
            <Label className={labelCol}>Wrap</Label>
            <Segmented<WrapValue>
              value={wrap}
              onChange={(v) => {
                setWrap(v);
                styleEdit.apply(target, 'flex-wrap', v);
              }}
              options={WRAP_OPTIONS}
            />
          </div>

          <div className={fieldRow}>
            <Label className={labelCol}>Gap</Label>
            <Input
              data-testid="paperx-layout-gap"
              type="text"
              inputMode="numeric"
              value={gap}
              placeholder="0"
              onChange={(e) => writeGap(e.currentTarget.value)}
              className="h-7 w-14 text-center text-xs"
            />
            <div className="flex-1">
              <Slider
                value={Math.min(128, parseInt(gap || '0', 10) || 0)}
                min={0}
                max={128}
                step={1}
                ariaLabel="Gap"
                onPreview={(v) => writeGap(String(v))}
                onChange={(v) => writeGap(String(v))}
              />
            </div>
          </div>
        </>
      )}

      {type === 'grid' && (
        <>
          <div className={fieldRow}>
            <Label className={labelCol}>Masonry</Label>
            <Segmented<Masonry>
              value={masonry}
              onChange={writeMasonry}
              options={MASONRY_OPTIONS}
            />
          </div>

          <div className={fieldRow}>
            <Label className={labelCol}>Columns</Label>
            <Input
              data-testid="paperx-layout-columns"
              type="text"
              inputMode="numeric"
              value={columns}
              placeholder="1"
              onChange={(e) => writeColumns(e.currentTarget.value)}
              className="h-7 w-14 text-center text-xs"
            />
            <IconButton
              ariaLabel="Decrement columns"
              size="sm"
              data-testid="paperx-layout-columns-dec"
              onClick={() => bumpColumns(-1)}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
            <IconButton
              ariaLabel="Increment columns"
              size="sm"
              data-testid="paperx-layout-columns-inc"
              onClick={() => bumpColumns(1)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
          </div>

          <div className={fieldRow}>
            <Label className={labelCol}>Gap</Label>
            <Input
              data-testid="paperx-layout-gap-x"
              type="text"
              inputMode="numeric"
              value={gapX}
              placeholder="X"
              onChange={(e) => writeGapXY('x', e.currentTarget.value)}
              className="h-7 w-14 text-center text-xs"
            />
            <Input
              data-testid="paperx-layout-gap-y"
              type="text"
              inputMode="numeric"
              value={gapY}
              placeholder="Y"
              onChange={(e) => writeGapXY('y', e.currentTarget.value)}
              className="h-7 w-14 text-center text-xs"
            />
          </div>
        </>
      )}

      <div className={fieldRow}>
        <Label className={labelCol}>Padding</Label>
        {paddingMode === 'uniform' ? (
          <Input
            data-testid="paperx-layout-padding"
            type="text"
            inputMode="numeric"
            value={padding.top}
            placeholder="0"
            onChange={(e) => writeUniformPadding(e.currentTarget.value)}
            className="h-7 w-14 text-center text-xs"
          />
        ) : (
          <div className="grid flex-1 grid-cols-4 gap-1">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <Input
                key={side}
                data-testid={`paperx-layout-padding-${side}`}
                type="text"
                inputMode="numeric"
                value={padding[side]}
                placeholder={side[0]!.toUpperCase()}
                onChange={(e) => writePaddingSide(side, e.currentTarget.value)}
                className="h-7 px-1 text-center text-xs"
              />
            ))}
          </div>
        )}
        <IconButton
          ariaLabel="Uniform padding"
          active={paddingMode === 'uniform'}
          size="sm"
          data-testid="paperx-layout-padding-uniform"
          onClick={() => setPaddingMode('uniform')}
        >
          <Square className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <IconButton
          ariaLabel="Per-side padding"
          active={paddingMode === 'per-side'}
          size="sm"
          data-testid="paperx-layout-padding-per-side"
          onClick={() => setPaddingMode('per-side')}
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>
    </div>
  );
});
LayoutSection.displayName = 'LayoutSection';
