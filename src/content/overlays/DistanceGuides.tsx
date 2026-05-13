/**
 * DistanceGuides — visBug-style distance labels between SELECTED and
 * HOVERED elements. Active in design / ruler / comment modes when both
 * are present and `hovered !== selected`.
 *
 * The (A, B) relationship classifier (`measureDistance`) returns a
 * variable-length segment list and, in the diagonal case, dashed
 * sight-line guides. This component is a dumb renderer: it draws one
 * 1px dashed pink connector + one chip per segment, and a 1px dashed
 * pink projection per alignment guide.
 *
 * Visual tokens:
 *   - connector / alignment guide: 1px dashed #F24E1E
 *   - chip: glass-dark surface tokens (paperx-glass-* CSS vars)
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import {
  measureDistance,
  type AlignmentGuide,
  type GapSegment,
} from '@/shared/utils/measureDistance';

const FIGMA_PINK = '#F24E1E';
const Z_LINE = 2147483639;
const Z_LABEL = 2147483641;

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
}

const GUIDE_MODES: ReadonlySet<string> = new Set(['design', 'ruler', 'comment']);

function chipStyle(x: number, y: number): React.CSSProperties {
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

function lineStyle(
  c: { x1: number; y1: number; x2: number; y2: number },
  orientation: 'horizontal' | 'vertical',
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: Z_LINE,
  };
  if (orientation === 'vertical') {
    const y1 = Math.min(c.y1, c.y2);
    const y2 = Math.max(c.y1, c.y2);
    return {
      ...base,
      left: `${c.x1 - 0.5}px`,
      top: `${y1}px`,
      width: 0,
      height: `${y2 - y1}px`,
      borderLeft: `1px dashed ${FIGMA_PINK}`,
    };
  }
  const x1 = Math.min(c.x1, c.x2);
  const x2 = Math.max(c.x1, c.x2);
  return {
    ...base,
    top: `${c.y1 - 0.5}px`,
    left: `${x1}px`,
    height: 0,
    width: `${x2 - x1}px`,
    borderTop: `1px dashed ${FIGMA_PINK}`,
  };
}

const SegmentView: React.FC<{ segment: GapSegment }> = ({ segment }) => {
  const text = String(Math.round(segment.value));
  return (
    <>
      <div aria-hidden style={lineStyle(segment.connector, segment.orientation)} />
      <div
        aria-hidden
        data-testid={`paperx-distance-${segment.side}`}
        data-kind={segment.kind}
        style={chipStyle(segment.chip.x, segment.chip.y)}
      >
        {text}
      </div>
    </>
  );
};

const AlignmentGuideView: React.FC<{ guide: AlignmentGuide }> = ({ guide }) => (
  <div
    aria-hidden
    data-testid="paperx-alignment-guide"
    style={lineStyle(guide, guide.orientation)}
  />
);

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

  const measurement = measureDistance(a, b);

  return (
    <>
      {measurement.segments.map((seg, i) => (
        <SegmentView key={`seg-${seg.side}-${i}`} segment={seg} />
      ))}
      {measurement.alignmentGuides.map((guide, i) => (
        <AlignmentGuideView key={`align-${i}`} guide={guide} />
      ))}
    </>
  );
});
DistanceGuides.displayName = 'DistanceGuides';
