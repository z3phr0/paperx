/**
 * GradientEditor — Figma-style linear/radial gradient editor primitive.
 *
 * Locked scope: linear + radial. Conic deferred. Leaf primitive — no
 * panel/host coupling, just `value`/`onChange`/`onPreview`. Color
 * picking reuses the existing ColorPicker so the shadow-DOM portal
 * contract stays centralized.
 */
import * as React from 'react';

import { ColorPicker } from '@/shared/ui/ColorPicker';
import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Segmented } from '@/shared/ui/Segmented';
import { cn } from '@/shared/ui/utils';

// ---------------------------------------------------------------------------
// Types + defaults
// ---------------------------------------------------------------------------

export type GradientStop = { pos: number; color: string; id: string };
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

let stopIdCounter = 0;
const nextStopId = (): string => `gs-${++stopIdCounter}`;

export const DEFAULT_VALUE: GradientValue = {
  type: 'linear',
  angle: 135,
  center: { x: 0.5, y: 0.5 },
  stops: [
    { id: 'gs-default-0', pos: 0, color: '#3b82f6' },
    { id: 'gs-default-1', pos: 1, color: '#ec4899' },
  ],
};

const clamp01 = (n: number): number =>
  Number.isNaN(n) ? 0 : Math.max(0, Math.min(1, n));

const wrap360 = (n: number): number => {
  if (Number.isNaN(n)) return 0;
  const v = n % 360;
  return v < 0 ? v + 360 : v;
};

const sortStops = (s: GradientStop[]): GradientStop[] =>
  s.slice().sort((a, b) => a.pos - b.pos);

// ---------------------------------------------------------------------------
// CSS serialization + best-effort parser
// ---------------------------------------------------------------------------

export function gradientToCss(g: GradientValue): string {
  const stopsCss = sortStops(g.stops)
    .map((s) => `${s.color} ${Math.round(clamp01(s.pos) * 100)}%`)
    .join(', ');
  if (g.type === 'radial') {
    const cx = Math.round(clamp01(g.center.x) * 100);
    const cy = Math.round(clamp01(g.center.y) * 100);
    return `radial-gradient(circle at ${cx}% ${cy}%, ${stopsCss})`;
  }
  return `linear-gradient(${Math.round(wrap360(g.angle))}deg, ${stopsCss})`;
}

/** Splits stops list by top-level commas (skips commas inside `(...)`). */
function splitTopLevelCommas(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of input) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(buf.trim());
      buf = '';
    } else buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** "<color> <pos>%" — color may contain spaces (e.g. "rgb(...)"). */
function parseStopToken(token: string, idx: number): GradientStop | null {
  const t = token.trim();
  const i = t.lastIndexOf(' ');
  if (i === -1) return null;
  const colorPart = t.slice(0, i).trim();
  const posPart = t.slice(i + 1).trim();
  if (!posPart.endsWith('%')) return null;
  const n = Number(posPart.slice(0, -1));
  if (Number.isNaN(n)) return null;
  return {
    id: `gs-parsed-${idx}-${nextStopId()}`,
    pos: clamp01(n / 100),
    color: colorPart,
  };
}

export function parseGradientCss(css: string): GradientValue | null {
  if (!css || typeof css !== 'string') return null;
  const trimmed = css.trim();

  const lin = trimmed.match(/^linear-gradient\(\s*([\s\S]+)\s*\)\s*$/i);
  if (lin) {
    const parts = splitTopLevelCommas(lin[1]!);
    if (parts.length < 3) return null;
    const angleM = parts[0]!.match(/^(-?\d+(?:\.\d+)?)deg$/i);
    if (!angleM) return null;
    const stops = parts.slice(1).map(parseStopToken);
    if (stops.some((s) => !s) || stops.length < 2) return null;
    return {
      type: 'linear',
      angle: wrap360(Number(angleM[1])),
      center: { x: 0.5, y: 0.5 },
      stops: sortStops(stops as GradientStop[]),
    };
  }

  const rad = trimmed.match(/^radial-gradient\(\s*([\s\S]+)\s*\)\s*$/i);
  if (rad) {
    const parts = splitTopLevelCommas(rad[1]!);
    if (parts.length < 3) return null;
    const head = parts[0]!.match(
      /^circle\s+at\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/i,
    );
    if (!head) return null;
    const stops = parts.slice(1).map(parseStopToken);
    if (stops.some((s) => !s) || stops.length < 2) return null;
    return {
      type: 'radial',
      angle: 0,
      center: {
        x: clamp01(Number(head[1]) / 100),
        y: clamp01(Number(head[2]) / 100),
      },
      stops: sortStops(stops as GradientStop[]),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Color interpolation (hex-only — falls back to left color)
// ---------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] | null {
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
  const a = parseHex(left);
  const b = parseHex(right);
  if (!a || !b) return left;
  const hh = (n: number): string =>
    Math.round(n).toString(16).padStart(2, '0');
  return `#${hh(a[0] + (b[0] - a[0]) * t)}${hh(a[1] + (b[1] - a[1]) * t)}${hh(
    a[2] + (b[2] - a[2]) * t,
  )}`;
}

// ---------------------------------------------------------------------------
// Pointer drag helper
// ---------------------------------------------------------------------------
//
// Captures the pointer on `target`, calls `compute(ev)` on every move
// (caller decides what to do with it — preview/commit), then releases
// capture and calls `compute(ev)` once more on pointerup as the commit.
function startDrag<T extends HTMLElement | SVGElement>(
  target: T,
  pointerId: number,
  onMove: (e: PointerEvent) => void,
  onCommit: (e: PointerEvent) => void,
): void {
  target.setPointerCapture(pointerId);
  const move = ((e: PointerEvent): void => onMove(e)) as EventListener;
  const up = ((e: PointerEvent): void => {
    try {
      target.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    onCommit(e);
  }) as EventListener;
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
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
  // Hooks-order rule: declare every hook BEFORE any conditional return.
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const dialRef = React.useRef<SVGSVGElement | null>(null);
  const radialRef = React.useRef<SVGSVGElement | null>(null);
  const [selectedStopId, setSelectedStopId] = React.useState<string | null>(
    () => value.stops[0]?.id ?? null,
  );
  const [angleDraft, setAngleDraft] = React.useState(
    () => String(Math.round(value.angle)),
  );
  const [cxDraft, setCxDraft] = React.useState(
    () => String(Math.round(value.center.x * 100)),
  );
  const [cyDraft, setCyDraft] = React.useState(
    () => String(Math.round(value.center.y * 100)),
  );

  // Sync drafts when value updates externally (parent commit etc.).
  React.useEffect(() => {
    setAngleDraft(String(Math.round(value.angle)));
  }, [value.angle]);
  React.useEffect(() => {
    setCxDraft(String(Math.round(value.center.x * 100)));
    setCyDraft(String(Math.round(value.center.y * 100)));
  }, [value.center.x, value.center.y]);

  const selectedStop = value.stops.find((s) => s.id === selectedStopId) ?? null;

  // ---- Mutations -------------------------------------------------------
  const updateStop = (
    id: string,
    patch: Partial<GradientStop>,
    mode: 'commit' | 'preview',
  ): void => {
    const stops = sortStops(
      value.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    const out = { ...value, stops };
    (mode === 'preview' ? onPreview : onChange)?.(out);
  };

  const insertStopAt = (pos: number): void => {
    const sorted = sortStops(value.stops);
    let leftIdx = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i]!.pos <= pos) leftIdx = i;
    }
    const left = sorted[leftIdx]!;
    const right = sorted[leftIdx + 1] ?? left;
    const span = right.pos - left.pos;
    const t = span > 0 ? clamp01((pos - left.pos) / span) : 0;
    const newStop: GradientStop = {
      id: nextStopId(),
      pos: clamp01(pos),
      color: interpolateColor(left.color, right.color, t),
    };
    onChange({ ...value, stops: sortStops([...value.stops, newStop]) });
    setSelectedStopId(newStop.id);
  };

  const deleteSelectedStop = (): void => {
    if (!selectedStop || value.stops.length <= 2) return;
    const next = value.stops.filter((s) => s.id !== selectedStop.id);
    onChange({ ...value, stops: sortStops(next) });
    setSelectedStopId(next[0]?.id ?? null);
  };

  // ---- Pointer drag handlers ------------------------------------------
  const stopFromPointer = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return clamp01((clientX - rect.left) / Math.max(1, rect.width));
  };

  const onStopPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    stopId: string,
  ): void => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedStopId(stopId);
    const target = e.currentTarget;
    startDrag(
      target,
      e.pointerId,
      (ev) => updateStop(stopId, { pos: stopFromPointer(ev.clientX) }, 'preview'),
      (ev) => updateStop(stopId, { pos: stopFromPointer(ev.clientX) }, 'commit'),
    );
  };

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return;
    insertStopAt(stopFromPointer(e.clientX));
  };

  const angleFromPointer = (clientX: number, clientY: number): number => {
    const svg = dialRef.current;
    if (!svg) return value.angle;
    const r = svg.getBoundingClientRect();
    // CSS gradient: 0deg is up, increases clockwise.
    const rad = Math.atan2(clientY - (r.top + r.height / 2), clientX - (r.left + r.width / 2));
    return wrap360(rad * (180 / Math.PI) + 90);
  };

  const onDialPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    e.preventDefault();
    const svg = dialRef.current;
    if (!svg) return;
    const update = (ev: PointerEvent | React.PointerEvent, mode: 'commit' | 'preview'): void => {
      const deg = angleFromPointer(ev.clientX, ev.clientY);
      const out = { ...value, angle: deg };
      setAngleDraft(String(Math.round(deg)));
      (mode === 'preview' ? onPreview : onChange)?.(out);
    };
    startDrag(
      svg,
      e.pointerId,
      (ev) => update(ev, 'preview'),
      (ev) => update(ev, 'commit'),
    );
    update(e, 'preview');
  };

  const centerFromPointer = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = radialRef.current;
    if (!svg) return value.center;
    const r = svg.getBoundingClientRect();
    return {
      x: clamp01((clientX - r.left) / Math.max(1, r.width)),
      y: clamp01((clientY - r.top) / Math.max(1, r.height)),
    };
  };

  const onRadialPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    e.preventDefault();
    const svg = radialRef.current;
    if (!svg) return;
    const update = (ev: PointerEvent | React.PointerEvent, mode: 'commit' | 'preview'): void => {
      const c = centerFromPointer(ev.clientX, ev.clientY);
      setCxDraft(String(Math.round(c.x * 100)));
      setCyDraft(String(Math.round(c.y * 100)));
      const out = { ...value, center: c };
      (mode === 'preview' ? onPreview : onChange)?.(out);
    };
    startDrag(
      svg,
      e.pointerId,
      (ev) => update(ev, 'preview'),
      (ev) => update(ev, 'commit'),
    );
    update(e, 'preview');
  };

  // ---- Numeric input commit handlers ---------------------------------
  const commitAngle = (): void => {
    const n = Number(angleDraft);
    const next = wrap360(Number.isFinite(n) ? n : value.angle);
    onChange({ ...value, angle: next });
    setAngleDraft(String(Math.round(next)));
  };

  const commitCenter = (): void => {
    const nx = Number(cxDraft);
    const ny = Number(cyDraft);
    const x = clamp01((Number.isFinite(nx) ? nx : value.center.x * 100) / 100);
    const y = clamp01((Number.isFinite(ny) ? ny : value.center.y * 100) / 100);
    onChange({ ...value, center: { x, y } });
    setCxDraft(String(Math.round(x * 100)));
    setCyDraft(String(Math.round(y * 100)));
  };

  const onEnterCommit = (commit: () => void) =>
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
    };

  const sortedStops = sortStops(value.stops);
  const previewCss = gradientToCss(value);

  // Inverted-triangle/diamond style for stop knobs.
  const knobBase =
    'absolute top-full -translate-x-1/2 -translate-y-1 cursor-grab touch-none ' +
    'h-3 w-3 rotate-45 border border-white/80 shadow ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  // Angle dial cursor coords.
  const dialRad = ((value.angle - 90) * Math.PI) / 180;
  const dialX = 32 + Math.cos(dialRad) * 24;
  const dialY = 32 + Math.sin(dialRad) * 24;

  // Radial center crosshair coords (in the 64x64 viewBox).
  const rCx = clamp01(value.center.x) * 64;
  const rCy = clamp01(value.center.y) * 64;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Type segmented */}
      <div className="flex items-center justify-between">
        <Label>Type</Label>
        <Segmented<GradientType>
          value={value.type}
          onChange={(t) => onChange({ ...value, type: t })}
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
            <line x1={32} y1={32} x2={dialX} y2={dialY} stroke="currentColor" strokeWidth={2} />
            <circle cx={dialX} cy={dialY} r={4} fill="currentColor" />
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
              onBlur={commitAngle}
              onKeyDown={onEnterCommit(commitAngle)}
              className="w-20"
            />
          </div>
        </div>
      )}

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
            <line x1={rCx} y1={0} x2={rCx} y2={64} stroke="currentColor" strokeOpacity={0.3} />
            <line x1={0} y1={rCy} x2={64} y2={rCy} stroke="currentColor" strokeOpacity={0.3} />
            <circle cx={rCx} cy={rCy} r={4} fill="currentColor" />
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
                onBlur={commitCenter}
                onKeyDown={onEnterCommit(commitCenter)}
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
                onBlur={commitCenter}
                onKeyDown={onEnterCommit(commitCenter)}
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

      {/* Stops track — knobs hang off the bottom. */}
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
                  knobBase,
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

      {selectedStop && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label>Color</Label>
            <div data-testid="paperx-gradient-stop-color-trigger">
              <ColorPicker
                value={selectedStop.color}
                onPreview={(hex) => updateStop(selectedStop.id, { color: hex }, 'preview')}
                onChange={(hex) => updateStop(selectedStop.id, { color: hex }, 'commit')}
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
                  updateStop(selectedStop.id, { pos: clamp01(n / 100) }, 'commit');
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
