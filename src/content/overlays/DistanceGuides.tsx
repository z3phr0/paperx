/**
 * DistanceGuides — Figma-style distance labels between the SELECTED
 * and HOVERED elements. Active in design / ruler / comment modes when
 * both are present and `hovered !== selected`.
 *
 * For each of the four edges (top / right / bottom / left) we compute
 * the signed pixel gap between A (selected) and B (hovered) via
 * `computeDistanceLabels` in `@/shared/utils/measureDistance`. Values
 * with |v| < 1 are filtered as noise; the remainder render as:
 *
 *   - a short 1px dashed #F24E1E connector between the two relevant
 *     edges (vertical for top/bottom, horizontal for left/right)
 *   - a small white label chip with the absolute integer px value,
 *     anchored at the connector midpoint
 *
 * Containment case (B inside A) returns all four positive distances —
 * they render as inset padding-style labels.
 *
 * Visual tokens follow Figma's pink connector + white chip convention:
 *   - line: 1px dashed #F24E1E
 *   - chip: #FFFFFF bg, #1F2937 text, 1px #E5E7EB border, 11px monospace
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import {
  computeDistanceLabels,
  type GapLabel,
} from '@/shared/utils/measureDistance';

const FIGMA_PINK = '#F24E1E';
const Z_LINE = 2147483639;
const Z_LABEL = 2147483641; // above the hover lines so chips stay readable

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
}

const GUIDE_MODES: ReadonlySet<string> = new Set(['design', 'ruler', 'comment']);
const MIN_PX = 1;

function chipStyle(x: number, y: number): React.CSSProperties {
  // Glass-dark chip aligned with paperx-surface design tokens. CSS
  // custom properties live on `:host` (tokens.css) and cascade through
  // the shadow DOM into inline styles. Future token tweaks (e.g.,
  // changing glass opacity) propagate automatically.
  return {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'hsl(var(--paperx-glass-bg) / var(--paperx-glass-alpha))',
    backdropFilter: 'blur(8px) saturate(180%)',
    WebkitBackdropFilter: 'blur(8px) saturate(180%)',
    color: 'hsl(var(--paperx-foreground))',
    border: '1px solid hsl(var(--paperx-glass-border) / var(--paperx-glass-border-alpha))',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '11px',
    lineHeight: 1.2,
    boxShadow: '0 2px 8px hsl(0 0% 0% / 0.4)',
    pointerEvents: 'none',
    zIndex: Z_LABEL,
    whiteSpace: 'nowrap',
  };
}

function connectorStyle(a: DOMRect, b: DOMRect, side: 'top' | 'right' | 'bottom' | 'left'): React.CSSProperties {
  // Each connector is a 1px dashed line from one rect's edge to the
  // other's, anchored at the midpoint of the perpendicular axis so it
  // visually lines up with the chip.
  const base: React.CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: Z_LINE,
  };
  if (side === 'top') {
    const y1 = Math.min(a.top, b.top);
    const y2 = Math.max(a.top, b.top);
    const overlapLeft = Math.max(a.left, b.left);
    const overlapRight = Math.min(a.right, b.right);
    const x = overlapRight > overlapLeft
      ? (overlapLeft + overlapRight) / 2
      : ((a.left + a.right) / 2 + (b.left + b.right) / 2) / 2;
    return {
      ...base,
      left: `${x - 0.5}px`,
      top: `${y1}px`,
      width: 0,
      height: `${y2 - y1}px`,
      borderLeft: `1px dashed ${FIGMA_PINK}`,
    };
  }
  if (side === 'bottom') {
    const y1 = Math.min(a.bottom, b.bottom);
    const y2 = Math.max(a.bottom, b.bottom);
    const overlapLeft = Math.max(a.left, b.left);
    const overlapRight = Math.min(a.right, b.right);
    const x = overlapRight > overlapLeft
      ? (overlapLeft + overlapRight) / 2
      : ((a.left + a.right) / 2 + (b.left + b.right) / 2) / 2;
    return {
      ...base,
      left: `${x - 0.5}px`,
      top: `${y1}px`,
      width: 0,
      height: `${y2 - y1}px`,
      borderLeft: `1px dashed ${FIGMA_PINK}`,
    };
  }
  if (side === 'left') {
    const x1 = Math.min(a.left, b.left);
    const x2 = Math.max(a.left, b.left);
    const overlapTop = Math.max(a.top, b.top);
    const overlapBottom = Math.min(a.bottom, b.bottom);
    const y = overlapBottom > overlapTop
      ? (overlapTop + overlapBottom) / 2
      : ((a.top + a.bottom) / 2 + (b.top + b.bottom) / 2) / 2;
    return {
      ...base,
      top: `${y - 0.5}px`,
      left: `${x1}px`,
      height: 0,
      width: `${x2 - x1}px`,
      borderTop: `1px dashed ${FIGMA_PINK}`,
    };
  }
  // right
  const x1 = Math.min(a.right, b.right);
  const x2 = Math.max(a.right, b.right);
  const overlapTop = Math.max(a.top, b.top);
  const overlapBottom = Math.min(a.bottom, b.bottom);
  const y = overlapBottom > overlapTop
    ? (overlapTop + overlapBottom) / 2
    : ((a.top + a.bottom) / 2 + (b.top + b.bottom) / 2) / 2;
  return {
    ...base,
    top: `${y - 0.5}px`,
    left: `${x1}px`,
    height: 0,
    width: `${x2 - x1}px`,
    borderTop: `1px dashed ${FIGMA_PINK}`,
  };
}

interface LabelRenderProps {
  side: 'top' | 'right' | 'bottom' | 'left';
  label: GapLabel;
  a: DOMRect;
  b: DOMRect;
}

const LabelPair: React.FC<LabelRenderProps> = ({ side, label, a, b }) => {
  if (Math.abs(label.value) < MIN_PX) return null;
  const text = String(Math.round(Math.abs(label.value)));
  return (
    <>
      <div aria-hidden style={connectorStyle(a, b, side)} />
      <div
        aria-hidden
        data-testid={`paperx-distance-${side}`}
        style={chipStyle(label.x, label.y)}
      >
        {text}
      </div>
    </>
  );
};

export const DistanceGuides = observer(({ uiStore, selectionStore }: Props) => {
  const visible =
    uiStore.visible &&
    uiStore.mode != null &&
    GUIDE_MODES.has(uiStore.mode) &&
    selectionStore.selected != null &&
    selectionStore.hovered != null &&
    selectionStore.hovered !== selectionStore.selected;

  const a = selectionStore.selectedRect;
  const b = selectionStore.hoveredRect;
  if (!visible || !a || !b) return null;

  const labels = computeDistanceLabels(a, b);

  return (
    <>
      <LabelPair side="top" label={labels.top} a={a} b={b} />
      <LabelPair side="right" label={labels.right} a={a} b={b} />
      <LabelPair side="bottom" label={labels.bottom} a={a} b={b} />
      <LabelPair side="left" label={labels.left} a={a} b={b} />
    </>
  );
});
DistanceGuides.displayName = 'DistanceGuides';
