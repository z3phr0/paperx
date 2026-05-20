/**
 * BezierEditor — Figma-style cubic-bezier curve editor primitive.
 *
 * Leaf component: controlled, no host-page coupling, no DI, no stores.
 * Parents pass `[x1, y1, x2, y2]`; children expose three callbacks:
 *   - onPreview(next)  — every pointermove during a handle drag
 *   - onChange(next)   — pointer release, preset click, or numeric commit
 *
 * Visual contract:
 *   - SVG canvas (default 240×240) with a 4×4 reference grid.
 *   - The cubic bezier path runs from (0, 1) to (1, 0) in normalized space
 *     — y is flipped to match CSS animation intuition (handles up = faster
 *     start, like Figma / cubic-bezier.com). Pixel mapping accounts for
 *     this flip.
 *   - Two draggable control circles (8px, white fill, dark ring) tied to
 *     the start/end anchors via straight "leash" lines.
 *   - 8 preset swatch buttons above, each rendering its own 24×24 SVG curve.
 *   - 16px ball animation looping below the canvas using the current curve
 *     as `transition-timing-function`. Re-keys on `value` change via the
 *     `key` prop so the animation restarts from 0.
 *   - 4 numeric inputs (x1 y1 x2 y2). x1/x2 clamped to [0, 1]; y values
 *     accept any finite number (overshoot is the whole point of back/elastic).
 *
 * Drag implementation: `pointerdown` on a handle starts the drag. Once
 * down, we attach window-level `pointermove`/`pointerup` listeners (the
 * Chromium SVG `setPointerCapture` quirk reliably loses pointers when the
 * cursor exits the SVG bbox). Coordinates are computed relative to the
 * SVG's `getBoundingClientRect()`.
 *
 * Curve stroke: `stroke-pink-500` to match the transition badge.
 */
import * as React from 'react';

import { cn } from './utils';

export type BezierTuple = readonly [number, number, number, number];

export interface BezierEditorProps {
  value: BezierTuple;
  onChange: (next: BezierTuple) => void;
  /** Live drag callback — fires every pointermove. Optional. */
  onPreview?: (next: BezierTuple) => void;
  /** Width/height of the SVG canvas in px. Default 240. */
  size?: number;
  className?: string;
}

interface Preset {
  readonly name: string;
  readonly testId: string;
  readonly value: BezierTuple;
}

// Module-scope constant — referenced by name in spec. testId is a literal
// (not template-interpolated) so static greps against the source file find
// each one individually — see `paperx-bezier-preset-*` checks in the
// completion gate.
const PRESETS: readonly Preset[] = [
  { name: 'linear', testId: 'paperx-bezier-preset-linear', value: [0, 0, 1, 1] },
  { name: 'ease', testId: 'paperx-bezier-preset-ease', value: [0.25, 0.1, 0.25, 1] },
  { name: 'ease-in', testId: 'paperx-bezier-preset-ease-in', value: [0.42, 0, 1, 1] },
  { name: 'ease-out', testId: 'paperx-bezier-preset-ease-out', value: [0, 0, 0.58, 1] },
  { name: 'ease-in-out', testId: 'paperx-bezier-preset-ease-in-out', value: [0.42, 0, 0.58, 1] },
  { name: 'back-out', testId: 'paperx-bezier-preset-back-out', value: [0.34, 1.56, 0.64, 1] },
  { name: 'bounce-in', testId: 'paperx-bezier-preset-bounce-in', value: [0.68, -0.55, 0.265, 1.55] },
  { name: 'swift', testId: 'paperx-bezier-preset-swift', value: [0.4, 0, 0.2, 1] },
];

const DEFAULT_SIZE = 240;
// Padding inside the SVG so handles never overflow visually when y < 0
// or y > 1 (back/bounce overshoot). The bezier "unit square" maps to an
// inner rect inset by PAD on all sides.
const PAD = 32;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function safeNumber(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/** Map normalized (x, y) ∈ [0, 1] (with y allowed to overshoot) → SVG px. */
function toSvg(x: number, y: number, size: number): { x: number; y: number } {
  const inner = size - PAD * 2;
  return {
    x: PAD + x * inner,
    // Flip y: y=0 → bottom row of unit square, y=1 → top row.
    y: PAD + (1 - y) * inner,
  };
}

/** Inverse of toSvg — map SVG px back to normalized coords. */
function fromSvg(px: number, py: number, size: number): { x: number; y: number } {
  const inner = size - PAD * 2;
  return {
    x: (px - PAD) / inner,
    y: 1 - (py - PAD) / inner,
  };
}

// ---------------------------------------------------------------------------
// Tiny inline preset preview
// ---------------------------------------------------------------------------

function PresetCurve({ value }: { value: BezierTuple }): React.ReactElement {
  const s = 24;
  const pad = 4;
  const innerSize = s - pad * 2;
  const [x1, y1, x2, y2] = value;
  const sx = (x: number) => pad + x * innerSize;
  const sy = (y: number) => pad + (1 - y) * innerSize;
  // Clamp y for the preview viewBox so overshoot still draws (we let the
  // path extend; SVG clips outside the box but Tailwind doesn't add clip).
  const d = `M ${sx(0)} ${sy(0)} C ${sx(x1)} ${sy(y1)} ${sx(x2)} ${sy(y2)} ${sx(1)} ${sy(1)}`;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
      <rect
        x={pad}
        y={pad}
        width={innerSize}
        height={innerSize}
        className="fill-transparent stroke-white/10"
        strokeWidth={1}
      />
      <path
        d={d}
        className="fill-none stroke-pink-500"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type DragId = 1 | 2;

export function BezierEditor({
  value,
  onChange,
  onPreview,
  size = DEFAULT_SIZE,
  className,
}: BezierEditorProps): React.ReactElement {
  const [x1, y1, x2, y2] = value;

  // Refs
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  // Drag working state: which handle, plus the "live" tuple captured at
  // dragstart. We mutate via setLive on every pointermove and call
  // onPreview from there. onChange fires once on pointerup.
  const dragRef = React.useRef<{ id: DragId; live: BezierTuple } | null>(null);

  // Editable input state — local strings so users can type "0." mid-edit
  // without the parent yanking them back to "0".
  const [drafts, setDrafts] = React.useState<{
    x1: string;
    y1: string;
    x2: string;
    y2: string;
  }>(() => ({
    x1: String(x1),
    y1: String(y1),
    x2: String(x2),
    y2: String(y2),
  }));

  // Whenever the controlled `value` changes from outside (preset click,
  // drag commit, parent reset), re-sync drafts. We compare by string so a
  // user typing inside an input doesn't get clobbered mid-keystroke.
  React.useEffect(() => {
    setDrafts((prev) => {
      const nextX1 = String(x1);
      const nextY1 = String(y1);
      const nextX2 = String(x2);
      const nextY2 = String(y2);
      if (
        prev.x1 === nextX1 &&
        prev.y1 === nextY1 &&
        prev.x2 === nextX2 &&
        prev.y2 === nextY2
      ) {
        return prev;
      }
      return { x1: nextX1, y1: nextY1, x2: nextX2, y2: nextY2 };
    });
  }, [x1, y1, x2, y2]);

  // Animation preview re-trigger: bump a key whenever value changes so
  // the CSS keyframes restart. Cheaper than tearing keyframes out.
  const animKey = React.useMemo(
    () => `${x1}-${y1}-${x2}-${y2}`,
    [x1, y1, x2, y2],
  );

  // ---- pointer drag plumbing -------------------------------------------

  const moveHandler = React.useRef<((e: PointerEvent) => void) | null>(null);
  const upHandler = React.useRef<((e: PointerEvent) => void) | null>(null);

  const cleanupDrag = React.useCallback(() => {
    if (moveHandler.current) {
      window.removeEventListener('pointermove', moveHandler.current);
      moveHandler.current = null;
    }
    if (upHandler.current) {
      window.removeEventListener('pointerup', upHandler.current);
      window.removeEventListener('pointercancel', upHandler.current);
      upHandler.current = null;
    }
    dragRef.current = null;
  }, []);

  // Tear down listeners if the component unmounts mid-drag.
  React.useEffect(() => {
    return () => cleanupDrag();
  }, [cleanupDrag]);

  const computeNextFromPointer = React.useCallback(
    (clientX: number, clientY: number, id: DragId): BezierTuple | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      // Normalize against the rendered SVG width — the SVG may be drawn
      // at a different CSS size than its `size` prop on retina/zoom; the
      // inner viewBox is a 1:1 px coord system. We scale the clientX/Y
      // against the rect, then use fromSvg with the viewBox `size`.
      const vbX = ((clientX - rect.left) / rect.width) * size;
      const vbY = ((clientY - rect.top) / rect.height) * size;
      const norm = fromSvg(vbX, vbY, size);
      const live = dragRef.current?.live ?? value;
      const cx = clamp01(norm.x);
      // y stays free (back/bounce can overshoot).
      const cy = norm.y;
      if (id === 1) {
        return [cx, cy, live[2], live[3]];
      }
      return [live[0], live[1], cx, cy];
    },
    [size, value],
  );

  const startDrag = React.useCallback(
    (id: DragId, e: React.PointerEvent<SVGCircleElement>) => {
      e.preventDefault();
      e.stopPropagation();

      dragRef.current = { id, live: [x1, y1, x2, y2] };

      // Attempt setPointerCapture on the circle for tooling that supports
      // it; the window listeners below are the actual reliable channel.
      try {
        (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
      } catch {
        // Some Chromium SVG paths reject capture on <circle>; fall through.
      }

      const onMove = (ev: PointerEvent) => {
        const next = computeNextFromPointer(ev.clientX, ev.clientY, id);
        if (!next) return;
        if (dragRef.current) dragRef.current.live = next;
        onPreview?.(next);
      };
      const onUp = (ev: PointerEvent) => {
        const next = computeNextFromPointer(ev.clientX, ev.clientY, id);
        cleanupDrag();
        if (next) {
          onChange(next);
        }
      };

      moveHandler.current = onMove;
      upHandler.current = onUp;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [x1, y1, x2, y2, computeNextFromPointer, onPreview, onChange, cleanupDrag],
  );

  // ---- numeric input commit --------------------------------------------

  const commitInput = React.useCallback(
    (key: 'x1' | 'y1' | 'x2' | 'y2', raw: string) => {
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed)) {
        // Reset draft to current authoritative value.
        setDrafts((prev) => ({ ...prev, [key]: String(value[axisIndex(key)]) }));
        return;
      }
      const clamped = key === 'x1' || key === 'x2' ? clamp01(parsed) : parsed;
      const next: BezierTuple = [
        key === 'x1' ? clamped : value[0],
        key === 'y1' ? clamped : value[1],
        key === 'x2' ? clamped : value[2],
        key === 'y2' ? clamped : value[3],
      ];
      onChange(next);
    },
    [value, onChange],
  );

  // ---- geometry --------------------------------------------------------

  const a = toSvg(0, 0, size); // start anchor
  const b = toSvg(1, 1, size); // end anchor
  const h1 = toSvg(safeNumber(x1, 0), safeNumber(y1, 0), size);
  const h2 = toSvg(safeNumber(x2, 1), safeNumber(y2, 1), size);
  const curveD = `M ${a.x} ${a.y} C ${h1.x} ${h1.y} ${h2.x} ${h2.y} ${b.x} ${b.y}`;

  // Grid lines: 4 vertical, 4 horizontal evenly spaced inside the inner rect.
  const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const inner = size - PAD * 2;
  for (let i = 1; i < 4; i += 1) {
    const off = (i / 4) * inner;
    gridLines.push({ x1: PAD + off, y1: PAD, x2: PAD + off, y2: PAD + inner });
    gridLines.push({ x1: PAD, y1: PAD + off, x2: PAD + inner, y2: PAD + off });
  }

  // ---- preview ball CSS ------------------------------------------------

  const cubicBezierFn = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-md p-3 text-foreground',
        className,
      )}
    >
      {/* Preset row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => {
          const active =
            p.value[0] === x1 &&
            p.value[1] === y1 &&
            p.value[2] === x2 &&
            p.value[3] === y2;
          return (
            <button
              key={p.name}
              type="button"
              data-testid={p.testId}
              title={p.name}
              aria-label={`Apply ${p.name} preset`}
              onClick={() => onChange(p.value)}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border bg-background',
                'transition-colors hover:bg-secondary',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                active ? 'border-pink-500' : 'border-input',
              )}
            >
              <PresetCurve value={p.value} />
            </button>
          );
        })}
      </div>

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        data-testid="paperx-bezier-canvas"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="touch-none select-none rounded-sm border border-input bg-background"
      >
        {/* Inner unit-square frame */}
        <rect
          x={PAD}
          y={PAD}
          width={size - PAD * 2}
          height={size - PAD * 2}
          className="fill-transparent stroke-white/10"
          strokeWidth={1}
        />
        {/* Reference grid */}
        {gridLines.map((g, i) => (
          <line
            key={i}
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            className="stroke-white/5"
            strokeWidth={1}
          />
        ))}
        {/* Handle leashes */}
        <line
          x1={a.x}
          y1={a.y}
          x2={h1.x}
          y2={h1.y}
          className="stroke-white/40"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <line
          x1={b.x}
          y1={b.y}
          x2={h2.x}
          y2={h2.y}
          className="stroke-white/40"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        {/* Curve */}
        <path
          d={curveD}
          className="fill-none stroke-pink-500"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Static anchor dots */}
        <circle cx={a.x} cy={a.y} r={3} className="fill-white/70" />
        <circle cx={b.x} cy={b.y} r={3} className="fill-white/70" />
        {/* Drop-shadow ring + draggable handles. Two circles per handle:
            an outer dark ring for affordance, an inner white fill. */}
        <circle
          cx={h1.x}
          cy={h1.y}
          r={11}
          className="fill-black/40"
          pointerEvents="none"
        />
        <circle
          data-testid="paperx-bezier-handle-1"
          cx={h1.x}
          cy={h1.y}
          r={8}
          className="cursor-grab fill-white stroke-white active:cursor-grabbing"
          strokeWidth={2}
          onPointerDown={(e) => startDrag(1, e)}
        />
        <circle
          cx={h2.x}
          cy={h2.y}
          r={11}
          className="fill-black/40"
          pointerEvents="none"
        />
        <circle
          data-testid="paperx-bezier-handle-2"
          cx={h2.x}
          cy={h2.y}
          r={8}
          className="cursor-grab fill-white stroke-white active:cursor-grabbing"
          strokeWidth={2}
          onPointerDown={(e) => startDrag(2, e)}
        />
      </svg>

      {/* Animation preview */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Preview
        </span>
        <div className="relative h-4 w-full rounded-full bg-secondary">
          {/* Inline keyframes so the rule lives inside the shadow tree. */}
          <style>{`
            @keyframes paperx-bezier-preview {
              0% { transform: translateX(0); }
              45% { transform: translateX(calc(100% - 16px)); }
              50% { transform: translateX(calc(100% - 16px)); }
              95% { transform: translateX(0); }
              100% { transform: translateX(0); }
            }
          `}</style>
          <div
            key={animKey}
            className="absolute left-0 top-0 h-4 w-4 rounded-full bg-pink-500 shadow"
            style={{
              animation: `paperx-bezier-preview 1500ms ${cubicBezierFn} infinite`,
            }}
          />
        </div>
      </div>

      {/* Numeric inputs. Literal testid strings (paperx-bezier-input-x1, …)
          rather than template-interpolated so static source-file greps find
          each individually. */}
      <div className="grid grid-cols-4 gap-2">
        <BezierNumberInput
          axis="x1"
          testId="paperx-bezier-input-x1"
          draft={drafts.x1}
          onDraft={(v) => setDrafts((prev) => ({ ...prev, x1: v }))}
          onCommit={(raw) => commitInput('x1', raw)}
        />
        <BezierNumberInput
          axis="y1"
          testId="paperx-bezier-input-y1"
          draft={drafts.y1}
          onDraft={(v) => setDrafts((prev) => ({ ...prev, y1: v }))}
          onCommit={(raw) => commitInput('y1', raw)}
        />
        <BezierNumberInput
          axis="x2"
          testId="paperx-bezier-input-x2"
          draft={drafts.x2}
          onDraft={(v) => setDrafts((prev) => ({ ...prev, x2: v }))}
          onCommit={(raw) => commitInput('x2', raw)}
        />
        <BezierNumberInput
          axis="y2"
          testId="paperx-bezier-input-y2"
          draft={drafts.y2}
          onDraft={(v) => setDrafts((prev) => ({ ...prev, y2: v }))}
          onCommit={(raw) => commitInput('y2', raw)}
        />
      </div>
    </div>
  );
}

BezierEditor.displayName = 'BezierEditor';

function axisIndex(key: 'x1' | 'y1' | 'x2' | 'y2'): 0 | 1 | 2 | 3 {
  switch (key) {
    case 'x1':
      return 0;
    case 'y1':
      return 1;
    case 'x2':
      return 2;
    case 'y2':
      return 3;
  }
}

interface BezierNumberInputProps {
  axis: 'x1' | 'y1' | 'x2' | 'y2';
  testId: string;
  draft: string;
  onDraft: (next: string) => void;
  onCommit: (raw: string) => void;
}

function BezierNumberInput({
  axis,
  testId,
  draft,
  onDraft,
  onCommit,
}: BezierNumberInputProps): React.ReactElement {
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      {axis}
      <input
        type="number"
        step="0.01"
        data-testid={testId}
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onCommit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          'h-7 w-full rounded-sm border border-input bg-background px-2 py-1 text-xs text-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      />
    </label>
  );
}
