/**
 * TransitionPanel — right-side floating drawer for the transition mode.
 *
 * Visibility contract (mirrors LayoutPanel):
 *   `uiStore.visible && uiStore.mode === 'transition' && selected != null`
 *
 * Sections:
 *   1. Property         — Segmented picker for `transition-property`
 *   2. Duration         — Slider bound to `transition-duration` (ms)
 *   3. Delay            — Slider bound to `transition-delay`    (ms)
 *   4. Timing function  — BezierEditor → `transition-timing-function`
 *
 * Writes flow ONLY through StyleEditService.apply so ChangeLog records
 * every commit. Slider preview drags do NOT write — only `onChange`
 * (Radix `onValueCommit`) hits styleEdit, matching the Sprint 1 split.
 *
 * Hooks-order rule: every `useState`/`useEffect` runs BEFORE any
 * conditional return — same defensive pattern as LayoutPanel.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Slider } from '@/shared/ui/Slider';
import { Segmented, type SegmentedOption } from '@/shared/ui/Segmented';
import { BezierEditor, type BezierTuple } from '@/shared/ui/BezierEditor';
import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { buildSelector } from '@/shared/types/changes';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  styleEdit: IStyleEditService;
}

type TransitionProperty =
  | 'all'
  | 'transform'
  | 'opacity'
  | 'color'
  | 'background-color'
  | 'width'
  | 'height';

const PROPERTY_OPTIONS: ReadonlyArray<SegmentedOption<TransitionProperty>> = [
  { value: 'all', label: 'all' },
  { value: 'transform', label: 'transform' },
  { value: 'opacity', label: 'opacity' },
  { value: 'color', label: 'color' },
  { value: 'background-color', label: 'bg' },
  { value: 'width', label: 'w' },
  { value: 'height', label: 'h' },
];

const KEYWORD_TO_BEZIER: Record<string, BezierTuple> = {
  ease: [0.25, 0.1, 0.25, 1],
  linear: [0, 0, 1, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

const DEFAULT_BEZIER: BezierTuple = KEYWORD_TO_BEZIER['ease']!;

function read(target: HTMLElement, prop: string): string {
  // Read seed values via getComputedStyle only — StyleEditService owns
  // inline mutations, so we never reach into the inline declaration here.
  try {
    return (getComputedStyle(target).getPropertyValue(prop) ?? '').trim();
  } catch {
    return '';
  }
}

function parseTimeMs(raw: string): number {
  // Computed style returns "0.3s" or "300ms"; "0s" is the default.
  if (!raw) return 0;
  const trimmed = raw.split(',')[0]!.trim();
  if (trimmed.endsWith('ms')) {
    const n = parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(n) ? n : 0;
  }
  if (trimmed.endsWith('s')) {
    const n = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(n) ? n * 1000 : 0;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
}

function parseTimingFunction(raw: string): BezierTuple {
  if (!raw) return DEFAULT_BEZIER;
  const trimmed = raw.split(/,(?![^()]*\))/)[0]!.trim().toLowerCase();
  if (trimmed in KEYWORD_TO_BEZIER) {
    return KEYWORD_TO_BEZIER[trimmed]!;
  }
  const m = trimmed.match(
    /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/,
  );
  if (m) {
    const a = parseFloat(m[1]!);
    const b = parseFloat(m[2]!);
    const c = parseFloat(m[3]!);
    const d = parseFloat(m[4]!);
    if ([a, b, c, d].every(Number.isFinite)) {
      return [a, b, c, d];
    }
  }
  return DEFAULT_BEZIER;
}

function coerceProperty(raw: string): TransitionProperty {
  const v = raw.split(',')[0]!.trim();
  switch (v) {
    case 'all':
    case 'transform':
    case 'opacity':
    case 'color':
    case 'background-color':
    case 'width':
    case 'height':
      return v;
    default:
      return 'all';
  }
}

export const TransitionPanel = observer(
  ({ uiStore, selectionStore, styleEdit }: Props) => {
    // Hooks-order rule — every hook MUST run before the early return.
    const target = selectionStore.selected;

    const propSeed = target
      ? coerceProperty(read(target, 'transition-property') || 'all')
      : 'all';
    const durationSeed = target ? parseTimeMs(read(target, 'transition-duration')) : 0;
    const delaySeed = target ? parseTimeMs(read(target, 'transition-delay')) : 0;
    const bezierSeed = target
      ? parseTimingFunction(read(target, 'transition-timing-function'))
      : DEFAULT_BEZIER;

    const [property, setProperty] = React.useState<TransitionProperty>(propSeed);
    const [duration, setDuration] = React.useState<number>(durationSeed);
    const [delay, setDelay] = React.useState<number>(delaySeed);
    const [bezier, setBezier] = React.useState<BezierTuple>(bezierSeed);

    React.useEffect(() => setProperty(propSeed), [propSeed]);
    React.useEffect(() => setDuration(durationSeed), [durationSeed]);
    React.useEffect(() => setDelay(delaySeed), [delaySeed]);
    const bezierKey = bezierSeed.join(',');
    React.useEffect(() => {
      setBezier(bezierSeed);
      // bezierKey is the joined tuple — re-sync when the seed shifts.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bezierKey]);

    const visible =
      uiStore.visible && uiStore.mode === 'transition' && target != null;
    if (!visible || !target) return null;

    const commitProperty = (next: TransitionProperty) => {
      setProperty(next);
      styleEdit.apply(target, 'transition-property', next, 'transition');
    };

    const commitDuration = (ms: number) => {
      setDuration(ms);
      styleEdit.apply(target, 'transition-duration', `${ms}ms`, 'transition');
    };

    const commitDelay = (ms: number) => {
      setDelay(ms);
      styleEdit.apply(target, 'transition-delay', `${ms}ms`, 'transition');
    };

    const commitBezier = (next: BezierTuple) => {
      setBezier(next);
      const [x1, y1, x2, y2] = next;
      styleEdit.apply(
        target,
        'transition-timing-function',
        `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
        'transition',
      );
    };

    return (
      <aside
        role="complementary"
        aria-label="paperx transition panel"
        data-testid="paperx-transition-panel"
        className="paperx-surface fixed right-4 top-14 bottom-4 z-[2147483640] w-[400px] overflow-y-auto rounded-lg p-2"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="mb-2 px-1 pt-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Selection
          </div>
          <div className="truncate font-mono text-[11px]">
            {buildSelector(target)}
          </div>
        </header>

        {/* Property */}
        <section className="mb-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Property
          </div>
          <div data-testid="paperx-transition-property" className="flex flex-wrap">
            <Segmented<TransitionProperty>
              value={property}
              onChange={commitProperty}
              options={PROPERTY_OPTIONS}
            />
          </div>
        </section>

        {/* Duration */}
        <section className="mb-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Duration
            </div>
            <div className="font-mono text-[11px] text-foreground">{duration}ms</div>
          </div>
          <div data-testid="paperx-transition-duration">
            <Slider
              value={duration}
              min={0}
              max={3000}
              step={10}
              ariaLabel="Transition duration in milliseconds"
              onPreview={(v) => setDuration(v)}
              onChange={commitDuration}
            />
          </div>
        </section>

        {/* Delay */}
        <section className="mb-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Delay
            </div>
            <div className="font-mono text-[11px] text-foreground">{delay}ms</div>
          </div>
          <div data-testid="paperx-transition-delay">
            <Slider
              value={delay}
              min={0}
              max={3000}
              step={10}
              ariaLabel="Transition delay in milliseconds"
              onPreview={(v) => setDelay(v)}
              onChange={commitDelay}
            />
          </div>
        </section>

        {/* Timing function */}
        <section className="mb-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Timing function
          </div>
          <BezierEditor
            value={bezier}
            onChange={commitBezier}
            onPreview={(next) => setBezier(next)}
          />
        </section>
      </aside>
    );
  },
);
TransitionPanel.displayName = 'TransitionPanel';
