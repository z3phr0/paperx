/**
 * GradientEditor — Figma-style linear/radial gradient editor primitive.
 *
 * Leaf primitive: no panel/host coupling. Just `value`/`onChange` +
 * internal SVG canvases. Locked scope: linear + radial only; conic
 * gradients are deferred per Sprint 3 plan.
 *
 * Composition:
 *   - Type segmented (linear / radial) at top.
 *   - Linear: 64px angle dial + numeric input.
 *   - Radial: 64x64 center picker + x/y % inputs.
 *   - Live preview bar.
 *   - Stops track with draggable knobs (insert by track click,
 *     delete via trash button, color via ColorPicker popover).
 *
 * Drag pattern: pointerdown on a knob captures the pointer with
 * `setPointerCapture` and binds pointermove/pointerup on the same
 * element. Track-level pointerdown adds a stop and immediately starts
 * dragging that new stop.
 */
import * as React from 'react';

import { ColorPicker } from '@/shared/ui/ColorPicker';
import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Segmented } from '@/shared/ui/Segmented';
import { cn } from '@/shared/ui/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GradientStop = {
  pos: number;
  color: string;
  id: string;
};

export type GradientType = 'linear' | 'radial';

export interface GradientValue {
  type: GradientType;
  angle: number;
  center: { x: number; y: number };
  stops: GradientStop[];
}

export interface GradientEditorProps {
  value: GradientValue;
  onChange: (next: GradientValue) => void;
  onPreview?: (next: GradientValue) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Defaults + helpers
// ---------------------------------------------------------------------------

let stopIdCounter = 0;
function nextStopId(): string {
  stopIdCounter += 1;
  return `gs-${stopIdCounter}`;
}

export const DEFAULT_VALUE: GradientValue = {
  type: 'linear',
  angle: 135,
  center: { x: 0.5, y: 0.5 },
  stops: [
    { id: 'gs-default-0', pos: 0, color: '#3b82f6' },
    { id: 'gs-default-1', pos: 1, color: '#ec4899' },
  ],
};

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function wrap360(n: number): number {
  if (Number.isNaN(n)) return 0;
  let v = n % 360;
  if (v < 0) v += 360;
  return v;
}

function sortStops(stops: GradientStop[]): GradientStop[] {
  return stops.slice().sort((a, b) => a.pos - b.pos);
}

// ---------------------------------------------------------------------------
// CSS serialization + best-effort parser
// ---------------------------------------------------------------------------

export function gradientToCss(g: GradientValue): string {
  const sorted = sortStops(g.stops);
  const stopsCss = sorted
    .map((s) => `${s.color} ${Math.round(clamp01(s.pos) * 100)}%`)
    .join(', ');
  if (g.type === 'radial') {
    const cx = Math.round(clamp01(g.center.x) * 100);
    const cy = Math.round(clamp01(g.center.y) * 100);
    return `radial-gradient(circle at ${cx}% ${cy}%, ${stopsCss})`;
  }
  return `linear-gradient(${Math.round(wrap360(g.angle))}deg, ${stopsCss})`;
}

/**
 * Splits a gradient stops list by top-level commas (commas inside
 * `rgb(...)` / `rgba(...)` / `hsl(...)` are preserved).
 */
function splitTopLevelCommas(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim() !== '') out.push(buf.trim());
  return out;
}

/**
 * Parse a "<color> <pos>%" stop. Color may itself contain spaces (e.g.
 * "rgb(255, 0, 0)"), so we treat the LAST whitespace-separated token as
 * the position if it ends with `%`.
 */
function parseStopToken(token: string, idx: number): GradientStop | null {
  const trimmed = token.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return null;
  const colorPart = trimmed.slice(0, lastSpace).trim();
  const posPart = trimmed.slice(lastSpace + 1).trim();
  if (!posPart.endsWith('%')) return null;
  const posNum = Number(posPart.slice(0, -1));
  if (Number.isNaN(posNum)) return null;
  return {
    id: `gs-parsed-${idx}-${nextStopId()}`,
    pos: clamp01(posNum / 100),
    color: colorPart,
  };
}

export function parseGradientCss(css: string): GradientValue | null {
  if (!css || typeof css !== 'string') return null;
  const trimmed = css.trim();

  const linearMatch = trimmed.match(/^linear-gradient\(\s*([\s\S]+)\s*\)\s*$/i);
  if (linearMatch) {
    const inner = linearMatch[1]!;
    const parts = splitTopLevelCommas(inner);
    if (parts.length < 3) return null;
    const angleMatch = parts[0]!.match(/^(-?\d+(?:\.\d+)?)deg$/i);
    if (!angleMatch) return null;
    const angle = wrap360(Number(angleMatch[1]));
    const stopParts = parts.slice(1);
    const stops: GradientStop[] = [];
    for (let i = 0; i < stopParts.length; i += 1) {
      const s = parseStopToken(stopParts[i]!, i);
      if (!s) return null;
      stops.push(s);
    }
    if (stops.length < 2) return null;
    return {
      type: 'linear',
      angle,
      center: { x: 0.5, y: 0.5 },
      stops: sortStops(stops),
    };
  }

  const radialMatch = trimmed.match(/^radial-gradient\(\s*([\s\S]+)\s*\)\s*$/i);
  if (radialMatch) {
    const inner = radialMatch[1]!;
    const parts = splitTopLevelCommas(inner);
    if (parts.length < 3) return null;
    const head = parts[0]!.trim();
    const headMatch = head.match(
      /^circle\s+at\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/i,
    );
    if (!headMatch) return null;
    const cx = clamp01(Number(headMatch[1]) / 100);
    const cy = clamp01(Number(headMatch[2]) / 100);
    const stopParts = parts.slice(1);
    const stops: GradientStop[] = [];
    for (let i = 0; i < stopParts.length; i += 1) {
      const s = parseStopToken(stopParts[i]!, i);
      if (!s) return null;
      stops.push(s);
    }
    if (stops.length < 2) return null;
    return {
      type: 'radial',
      angle: 0,
      center: { x: cx, y: cy },
      stops: sortStops(stops),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Color interpolation (best-effort, hex-only — falls back to left color)
// ---------------------------------------------------------------------------

function parseHexComponent(hex: string): [number, number, number] | null {
  const m6 = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (m6) {
    const s = m6[1]!;
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  }
  const m3 = /^#([0-9a-f]{3})$/i.exec(hex.trim());
  if (m3) {
    const s = m3[1]!;
    return [
      parseInt(s[0]! + s[0]!, 16),
      parseInt(s[1]! + s[1]!, 16),
      parseInt(s[2]! + s[2]!, 16),
    ];
  }
  return null;
}

function interpolateColor(left: string, right: string, t: number): string {
  const a = parseHexComponent(left);
  const b = parseHexComponent(right);
  if (!a || !b) return left;
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  const hh = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${hh(r)}${hh(g)}${hh(bl)}`;
}

// ---------------------------------------------------------------------------
// Drag handling
// ---------------------------------------------------------------------------

function getRelativeFraction(
  e: React.PointerEvent | PointerEvent,
  rect: DOMRect,
): number {
  return clamp01((e.clientX - rect.left) / Math.max(1, rect.width));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GradientEditor: React.FC<GradientEditorProps> = ({
  value,
  onChange,
  onPreview,
  className,
}) => {
  // Hooks: declare all before any conditional return.
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const dialRef = React.useRef<SVGSVGElement | null>(null);
  const radialRef = React.useRef<SVGSVGElement | null>(null);
  const [selectedStopId, setSelectedStopId] = React.useState<string | null>(
    () => value.stops[0]?.id ?? null,
  );
  // Local angle/center inputs allow free typing without immediately
  // re-clamping every keystroke; we commit on blur/Enter.
  const [angleDraft, setAngleDraft] = React.useState<string>(
    String(Math.round(value.angle)),
  );
  const [cxDraft, setCxDraft] = React.useState<string>(
    String(Math.round(value.center.x * 100)),
  );
  const [cyDraft, setCyDraft] = React.useState<string>(
    String(Math.round(value.center.y * 100)),
  );

  // Keep input drafts in sync when value updates externally.
  React.useEffect(() => {
    setAngleDraft(String(Math.round(value.angle)));
  }, [value.angle]);
  React.useEffect(() => {
    setCxDraft(String(Math.round(value.center.x * 100)));
    setCyDraft(String(Math.round(value.center.y * 100)));
  }, [value.center.x, value.center.y]);

  // Track-relative live drag state — kept in a ref so pointermove handlers
  // attached at pointerdown time always see fresh data without re-binding.
  const dragStateRef = React.useRef<{
    kind: 'stop';
    stopId: string;
  } | null>(null);

  // Ensure selection still references an existing stop.
  const selectedStop = value.stops.find((s) => s.id === selectedStopId) ?? null;

  // ---- Type switch -------------------------------------------------------
  const handleTypeChange = (next: GradientType) => {
    onChange({ ...value, type: next });
  };

  // ---- Stops mutations ---------------------------------------------------
  const updateStops = (
    next: GradientStop[],
    mode: 'commit' | 'preview',
  ): void => {
    const sorted = sortStops(next);
    const out = { ...value, stops: sorted };
    if (mode === 'preview') onPreview?.(out);
    else onChange(out);
  };

  const updateStopAt = (
    id: string,
    patch: Partial<GradientStop>,
    mode: 'commit' | 'preview',
  ): void => {
    const next = value.stops.map((s) => (s.id === id ? { ...s, ...patch } : s));
    updateStops(next, mode);
  };

  const insertStopAt = (pos: number) => {
    const sorted = sortStops(value.stops);
    let leftIdx = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i]!.pos <= pos) leftIdx = i;
    }
    const left = sorted[leftIdx]!;
    const right = sorted[leftIdx + 1] ?? left;
    const span = right.pos - left.pos;
    const t = span > 0 ? clamp01((pos - left.pos) / span) : 0;
    const color = interpolateColor(left.color, right.color, t);
    const newStop: GradientStop = {
      id: nextStopId(),
      pos: clamp01(pos),
      color,
    };
    const next = sortStops([...value.stops, newStop]);
    onChange({ ...value, stops: next });
    setSelectedStopId(newStop.id);
    return newStop;
  };

  const deleteSelectedStop = () => {
    if (!selectedStop) return;
    if (value.stops.length <= 2) return;
    const next = value.stops.filter((s) => s.id !== selectedStop.id);
    onChange({ ...value, stops: sortStops(next) });
    setSelectedStopId(next[0]?.id ?? null);
  };

  // ---- Stop-knob drag ----------------------------------------------------
  const onStopPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    stopId: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedStopId(stopId);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    dragStateRef.current = { kind: 'stop', stopId };

    const handleMove = (moveEvent: PointerEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const frac = clamp01(
        (moveEvent.clientX - rect.left) / Math.max(1, rect.width),
      );
      updateStopAt(stopId, { pos: frac }, 'preview');
    };
    const handleUp = (upEvent: PointerEvent) => {
      try {
        target.releasePointerCapture(upEvent.pointerId);
      } catch {
        // Capture may have already been released — ignore.
      }
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      target.removeEventListener('pointercancel', handleUp);
      const rect = trackRef.current?.getBoundingClientRect();
      if (rect) {
        const frac = clamp01(
          (upEvent.clientX - rect.left) / Math.max(1, rect.width),
        );
        updateStopAt(stopId, { pos: frac }, 'commit');
      }
      dragStateRef.current = null;
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
    target.addEventListener('pointercancel', handleUp);
  };

  // ---- Track click → insert stop ----------------------------------------
  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // clicking a knob is handled there
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = getRelativeFraction(e, rect);
    insertStopAt(frac);
  };

  // ---- Angle dial drag ---------------------------------------------------
  const onDialPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = dialRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    const compute = (clientX: number, clientY: number) => {
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      // CSS gradient angle: 0deg points up, increases clockwise.
      const rad = Math.atan2(dy, dx);
      const deg = wrap360(rad * (180 / Math.PI) + 90);
      return deg;
    };
    const handleMove = (ev: PointerEvent) => {
      const deg = compute(ev.clientX, ev.clientY);
      onPreview?.({ ...value, angle: deg });
      setAngleDraft(String(Math.round(deg)));
    };
    const handleUp = (ev: PointerEvent) => {
      try {
        svg.releasePointerCapture(ev.pointerId);
      } catch {
        // already released
      }
      svg.removeEventListener('pointermove', handleMove);
      svg.removeEventListener('pointerup', handleUp);
      svg.removeEventListener('pointercancel', handleUp);
      const deg = compute(ev.clientX, ev.clientY);
      onChange({ ...value, angle: deg });
    };
    svg.addEventListener('pointermove', handleMove);
    svg.addEventListener('pointerup', handleUp);
    svg.addEventListener('pointercancel', handleUp);
    // Also fire an initial preview at click point.
    const deg = compute(e.clientX, e.clientY);
    onPreview?.({ ...value, angle: deg });
    setAngleDraft(String(Math.round(deg)));
  };

  // ---- Radial center drag ------------------------------------------------
  const onRadialPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = radialRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    const compute = (clientX: number, clientY: number) => {
      const rect = svg.getBoundingClientRect();
      const x = clamp01((clientX - rect.left) / Math.max(1, rect.width));
      const y = clamp01((clientY - rect.top) / Math.max(1, rect.height));
      return { x, y };
    };
    const handleMove = (ev: PointerEvent) => {
      const c = compute(ev.clientX, ev.clientY);
      onPreview?.({ ...value, center: c });
      setCxDraft(String(Math.round(c.x * 100)));
      setCyDraft(String(Math.round(c.y * 100)));
    };
    const handleUp = (ev: PointerEvent) => {
      try {
        svg.releasePointerCapture(ev.pointerId);
      } catch {
        // already released
      }
      svg.removeEventListener('pointermove', handleMove);
      svg.removeEventListener('pointerup', handleUp);
      svg.removeEventListener('pointercancel', handleUp);
      const c = compute(ev.clientX, ev.clientY);
      onChange({ ...value, center: c });
    };
    svg.addEventListener('pointermove', handleMove);
    svg.addEventListener('pointerup', handleUp);
    svg.addEventListener('pointercancel', handleUp);
    const c = compute(e.clientX, e.clientY);
    onPreview?.({ ...value, center: c });
    setCxDraft(String(Math.round(c.x * 100)));
    setCyDraft(String(Math.round(c.y * 100)));
  };

  // ---- Numeric input commit handlers ------------------------------------
  const commitAngleDraft = () => {
    const n = Number(angleDraft);
    const next = wrap360(Number.isFinite(n) ? n : value.angle);
    onChange({ ...value, angle: next });
    setAngleDraft(String(Math.round(next)));
  };
  const commitCenterDraft = () => {
    const nx = Number(cxDraft);
    const ny = Number(cyDraft);
    const x = clamp01((Number.isFinite(nx) ? nx : value.center.x * 100) / 100);
    const y = clamp01((Number.isFinite(ny) ? ny : value.center.y * 100) / 100);
    onChange({ ...value, center: { x, y } });
    setCxDraft(String(Math.round(x * 100)));
    setCyDraft(String(Math.round(y * 100)));
  };

  const sortedStops = sortStops(value.stops);
  const previewCss = gradientToCss(value);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Type segmented */}
      <div className="flex items-center justify-between">
        <Label>Type</Label>
        <Segmented<GradientType>
          value={value.type}
          onChange={handleTypeChange}
          options={[
            {
              value: 'linear',
              label: <span data-testid="paperx-gradient-type-linear">Linear</span>,
              ariaLabel: 'Linear gradient',
            },
            {
              value: 'radial',
              label: <span data-testid="paperx-gradient-type-radial">Radial</span>,
              ariaLabel: 'Radial gradient',
            },
          ]}
        />
      </div>

      {/* Linear: angle dial */}
      {value.type === 'linear' && (
        <div className="flex items-center gap-3">
          <svg
            ref={dialRef}
            data-testid="paperx-gradient-angle-dial"
            width={64}
            height={64}
            viewBox="0 0 64 64"
            className="shrink-0 cursor-grab touch-none rounded-full border border-input bg-background"
            onPointerDown={onDialPointerDown}
          >
            <circle cx={32} cy={32} r={28} fill="none" stroke="currentColor" strokeOpacity={0.2} />
            {(() => {
              const rad = ((value.angle - 90) * Math.PI) / 180;
              const x = 32 + Math.cos(rad) * 24;
              const y = 32 + Math.sin(rad) * 24;
              return (
                <>
                  <line x1={32} y1={32} x2={x} y2={y} stroke="currentColor" strokeWidth={2} />
                  <circle cx={x} cy={y} r={4} fill="currentColor" />
                </>
              );
            })()}
            <circle cx={32} cy={32} r={2} fill="currentColor" fillOpacity={0.6} />
          </svg>
          <div className="flex flex-col gap-1">
            <Label htmlFor="paperx-gradient-angle-input">Angle</Label>
            <Input
              id="paperx-gradient-angle-input"
              data-testid="paperx-gradient-angle-input"
              type="number"
              value={angleDraft}
              onChange={(e) => setAngleDraft(e.currentTarget.value)}
              onBlur={commitAngleDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitAngleDraft();
                }
              }}
              className="w-20"
            />
          </div>
        </div>
      )}

      {/* Radial: center picker */}
      {value.type === 'radial' && (
        <div className="flex items-center gap-3">
          <svg
            ref={radialRef}
            width={64}
            height={64}
            viewBox="0 0 64 64"
            className="shrink-0 cursor-crosshair touch-none rounded-sm border border-input bg-background"
            onPointerDown={onRadialPointerDown}
          >
            <rect x={0} y={0} width={64} height={64} fill="transparent" />
            {(() => {
              const cx = clamp01(value.center.x) * 64;
              const cy = clamp01(value.center.y) * 64;
              return (
                <>
                  <line x1={cx} y1={0} x2={cx} y2={64} stroke="currentColor" strokeOpacity={0.3} />
                  <line x1={0} y1={cy} x2={64} y2={cy} stroke="currentColor" strokeOpacity={0.3} />
                  <circle cx={cx} cy={cy} r={4} fill="currentColor" />
                </>
              );
            })()}
          </svg>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="paperx-gradient-center-x">X%</Label>
              <Input
                id="paperx-gradient-center-x"
                data-testid="paperx-gradient-center-x"
                type="number"
                value={cxDraft}
                onChange={(e) => setCxDraft(e.currentTarget.value)}
                onBlur={commitCenterDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitCenterDraft();
                  }
                }}
                className="w-16"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="paperx-gradient-center-y">Y%</Label>
              <Input
                id="paperx-gradient-center-y"
                data-testid="paperx-gradient-center-y"
                type="number"
                value={cyDraft}
                onChange={(e) => setCyDraft(e.currentTarget.value)}
                onBlur={commitCenterDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitCenterDraft();
                  }
                }}
                className="w-16"
              />
            </div>
          </div>
        </div>
      )}

      {/* Preview bar */}
      <div
        data-testid="paperx-gradient-canvas"
        className="h-6 w-full rounded-sm border border-input"
        style={{ background: previewCss }}
      />

      {/* Stops track */}
      <div className="relative pt-1">
        <div
          ref={trackRef}
          className="relative h-6 w-full cursor-copy rounded-sm border border-input"
          style={{ background: previewCss }}
          onPointerDown={onTrackPointerDown}
        >
          {sortedStops.map((stop) => {
            const idx = value.stops.findIndex((s) => s.id === stop.id);
            const isSelected = stop.id === selectedStopId;
            return (
              <button
                key={stop.id}
                type="button"
                data-testid={`paperx-gradient-stop-${idx}`}
                aria-label={`Stop ${idx + 1} at ${Math.round(stop.pos * 100)}%`}
                onPointerDown={(e) => onStopPointerDown(e, stop.id)}
                className={cn(
                  'absolute top-full -translate-x-1/2 -translate-y-1 cursor-grab touch-none',
                  'h-3 w-3 rotate-45 border border-white/80 shadow',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected && 'ring-2 ring-offset-1 ring-offset-background',
                )}
                style={{
                  left: `${clamp01(stop.pos) * 100}%`,
                  backgroundColor: stop.color,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Selected-stop row */}
      {selectedStop && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label>Color</Label>
            <div data-testid="paperx-gradient-stop-color-trigger">
              <ColorPicker
                value={selectedStop.color}
                onPreview={(hex) =>
                  updateStopAt(selectedStop.id, { color: hex }, 'preview')
                }
                onChange={(hex) =>
                  updateStopAt(selectedStop.id, { color: hex }, 'commit')
                }
                ariaLabel="Stop color"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="paperx-gradient-stop-pos">Pos %</Label>
            <Input
              id="paperx-gradient-stop-pos"
              data-testid="paperx-gradient-stop-pos"
              type="number"
              min={0}
              max={100}
              value={Math.round(selectedStop.pos * 100)}
              onChange={(e) => {
                const n = Number(e.currentTarget.value);
                if (Number.isFinite(n)) {
                  updateStopAt(
                    selectedStop.id,
                    { pos: clamp01(n / 100) },
                    'commit',
                  );
                }
              }}
              className="w-16"
            />
          </div>
          <button
            type="button"
            data-testid="paperx-gradient-stop-delete"
            aria-label="Delete stop"
            disabled={value.stops.length <= 2}
            onClick={deleteSelectedStop}
            className={cn(
              'inline-flex h-7 items-center justify-center rounded-sm border border-input bg-background px-2 text-xs',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {/* Inline trash glyph — no new dep. */}
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m-5 0v9a1 1 0 001 1h4a1 1 0 001-1V4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

GradientEditor.displayName = 'GradientEditor';
