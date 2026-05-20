/**
 * Distance measurement between two DOMRects (selected A vs hovered B),
 * classified visBug-style by their geometric relationship.
 *
 * Older revisions returned four same-side gaps unconditionally — that
 * reads correctly only when B is contained inside A (the Figma-style
 * padding view). When B sits outside A, four same-side numbers are
 * misleading: the eye sees one perpendicular gap, not four.
 *
 * This module instead classifies (A, B) into one of:
 *
 *   - `identical`      — same rect, render nothing.
 *   - `contained`      — one rect inside the other (or partial overlap,
 *                        treated as inset for graceful fallback). Renders
 *                        4 same-side inset segments.
 *   - `vertical-gap`   — horizontal-axis overlap, B above or below A.
 *                        Renders 1 outer segment along the shared x range.
 *   - `horizontal-gap` — vertical-axis overlap, B left or right of A.
 *                        Renders 1 outer segment along the shared y range.
 *   - `diagonal`       — no overlap on either axis. Renders 2 outer
 *                        segments forming an L at A's nearest corner,
 *                        plus 2 dashed alignment guides forming the
 *                        mirroring L at B's nearest corner (sight lines).
 *
 * Each `GapSegment` carries fully resolved viewport-space coordinates
 * for its connector line and chip anchor so the renderer is dumb.
 * Sub-pixel (< MIN_PX) segments are filtered out at classification time.
 */

export type DistanceCase =
  | 'contained'
  | 'vertical-gap'
  | 'horizontal-gap'
  | 'diagonal'
  | 'identical';

export interface GapSegment {
  /** Absolute pixel magnitude of the gap; always positive. */
  value: number;
  /** Which side of A this segment originates from. */
  side: 'top' | 'right' | 'bottom' | 'left';
  /** Connector endpoints in viewport coords (fixed positioning). */
  connector: { x1: number; y1: number; x2: number; y2: number };
  /** Chip anchor (translate(-50%,-50%) centers on this point). */
  chip: { x: number; y: number };
  orientation: 'horizontal' | 'vertical';
  /** 'inset' = containment (between A's and B's same-side edges).
   *  'outer' = between facing edges of disjoint rects. */
  kind: 'inset' | 'outer';
}

export interface AlignmentGuide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: 'horizontal' | 'vertical';
}

export interface DistanceMeasurement {
  case: DistanceCase;
  segments: GapSegment[];
  alignmentGuides: AlignmentGuide[];
}

const MIN_PX = 1;

function overlapMidX(a: DOMRect, b: DOMRect): number {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  if (right > left) return (left + right) / 2;
  const aCx = (a.left + a.right) / 2;
  const bCx = (b.left + b.right) / 2;
  return (aCx + bCx) / 2;
}

function overlapMidY(a: DOMRect, b: DOMRect): number {
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  if (bottom > top) return (top + bottom) / 2;
  const aCy = (a.top + a.bottom) / 2;
  const bCy = (b.top + b.bottom) / 2;
  return (aCy + bCy) / 2;
}

function makeInsetSegment(
  side: 'top' | 'right' | 'bottom' | 'left',
  edgeA: number,
  edgeB: number,
  perpendicularAnchor: number,
): GapSegment {
  const value = Math.abs(edgeB - edgeA);
  const lo = Math.min(edgeA, edgeB);
  const hi = Math.max(edgeA, edgeB);
  const mid = (edgeA + edgeB) / 2;
  if (side === 'top' || side === 'bottom') {
    return {
      value,
      side,
      orientation: 'vertical',
      kind: 'inset',
      connector: { x1: perpendicularAnchor, y1: lo, x2: perpendicularAnchor, y2: hi },
      chip: { x: perpendicularAnchor, y: mid },
    };
  }
  return {
    value,
    side,
    orientation: 'horizontal',
    kind: 'inset',
    connector: { x1: lo, y1: perpendicularAnchor, x2: hi, y2: perpendicularAnchor },
    chip: { x: mid, y: perpendicularAnchor },
  };
}

function buildContained(a: DOMRect, b: DOMRect): DistanceMeasurement {
  const mx = overlapMidX(a, b);
  const my = overlapMidY(a, b);
  const raw: GapSegment[] = [
    makeInsetSegment('top', a.top, b.top, mx),
    makeInsetSegment('right', a.right, b.right, my),
    makeInsetSegment('bottom', a.bottom, b.bottom, mx),
    makeInsetSegment('left', a.left, b.left, my),
  ];
  return {
    case: 'contained',
    segments: raw.filter((s) => s.value >= MIN_PX),
    alignmentGuides: [],
  };
}

function buildVerticalGap(a: DOMRect, b: DOMRect): DistanceMeasurement {
  const bAboveA = b.bottom <= a.top;
  const side: 'top' | 'bottom' = bAboveA ? 'top' : 'bottom';
  const edgeA = bAboveA ? a.top : a.bottom;
  const edgeB = bAboveA ? b.bottom : b.top;
  const value = Math.abs(edgeA - edgeB);
  if (value < MIN_PX) {
    return { case: 'vertical-gap', segments: [], alignmentGuides: [] };
  }
  const x = overlapMidX(a, b);
  const lo = Math.min(edgeA, edgeB);
  const hi = Math.max(edgeA, edgeB);
  return {
    case: 'vertical-gap',
    segments: [
      {
        value,
        side,
        orientation: 'vertical',
        kind: 'outer',
        connector: { x1: x, y1: lo, x2: x, y2: hi },
        chip: { x, y: (edgeA + edgeB) / 2 },
      },
    ],
    alignmentGuides: [],
  };
}

function buildHorizontalGap(a: DOMRect, b: DOMRect): DistanceMeasurement {
  const bRightOfA = b.left >= a.right;
  const side: 'left' | 'right' = bRightOfA ? 'right' : 'left';
  const edgeA = bRightOfA ? a.right : a.left;
  const edgeB = bRightOfA ? b.left : b.right;
  const value = Math.abs(edgeA - edgeB);
  if (value < MIN_PX) {
    return { case: 'horizontal-gap', segments: [], alignmentGuides: [] };
  }
  const y = overlapMidY(a, b);
  const lo = Math.min(edgeA, edgeB);
  const hi = Math.max(edgeA, edgeB);
  return {
    case: 'horizontal-gap',
    segments: [
      {
        value,
        side,
        orientation: 'horizontal',
        kind: 'outer',
        connector: { x1: lo, y1: y, x2: hi, y2: y },
        chip: { x: (edgeA + edgeB) / 2, y },
      },
    ],
    alignmentGuides: [],
  };
}

function buildDiagonal(a: DOMRect, b: DOMRect): DistanceMeasurement {
  const bRightOfA = b.left >= a.right;
  const bBelowA = b.bottom <= a.top ? false : b.top >= a.bottom;

  const hSide: 'left' | 'right' = bRightOfA ? 'right' : 'left';
  const hEdgeA = bRightOfA ? a.right : a.left;
  const hEdgeB = bRightOfA ? b.left : b.right;
  const hValue = Math.abs(hEdgeA - hEdgeB);

  const vSide: 'top' | 'bottom' = bBelowA ? 'bottom' : 'top';
  const vEdgeA = bBelowA ? a.bottom : a.top;
  const vEdgeB = bBelowA ? b.top : b.bottom;
  const vValue = Math.abs(vEdgeA - vEdgeB);

  // Nearest corners: solid L at A's corner, dashed L at B's corner.
  const aCornerX = bRightOfA ? a.right : a.left;
  const aCornerY = bBelowA ? a.bottom : a.top;
  const bCornerX = bRightOfA ? b.left : b.right;
  const bCornerY = bBelowA ? b.top : b.bottom;

  const segments: GapSegment[] = [];
  if (hValue >= MIN_PX) {
    const lo = Math.min(hEdgeA, hEdgeB);
    const hi = Math.max(hEdgeA, hEdgeB);
    segments.push({
      value: hValue,
      side: hSide,
      orientation: 'horizontal',
      kind: 'outer',
      connector: { x1: lo, y1: aCornerY, x2: hi, y2: aCornerY },
      chip: { x: (hEdgeA + hEdgeB) / 2, y: aCornerY },
    });
  }
  if (vValue >= MIN_PX) {
    const lo = Math.min(vEdgeA, vEdgeB);
    const hi = Math.max(vEdgeA, vEdgeB);
    segments.push({
      value: vValue,
      side: vSide,
      orientation: 'vertical',
      kind: 'outer',
      connector: { x1: aCornerX, y1: lo, x2: aCornerX, y2: hi },
      chip: { x: aCornerX, y: (vEdgeA + vEdgeB) / 2 },
    });
  }

  const alignmentGuides: AlignmentGuide[] = [];
  if (hValue >= MIN_PX && vValue >= MIN_PX) {
    // Horizontal sight-line at B's near top/bottom level, spanning the gap.
    alignmentGuides.push({
      x1: Math.min(aCornerX, bCornerX),
      y1: bCornerY,
      x2: Math.max(aCornerX, bCornerX),
      y2: bCornerY,
      orientation: 'horizontal',
    });
    // Vertical sight-line at B's near left/right level, spanning the gap.
    alignmentGuides.push({
      x1: bCornerX,
      y1: Math.min(aCornerY, bCornerY),
      x2: bCornerX,
      y2: Math.max(aCornerY, bCornerY),
      orientation: 'vertical',
    });
  }

  return { case: 'diagonal', segments, alignmentGuides };
}

export function measureDistance(a: DOMRect, b: DOMRect): DistanceMeasurement {
  if (
    a.left === b.left &&
    a.right === b.right &&
    a.top === b.top &&
    a.bottom === b.bottom
  ) {
    return { case: 'identical', segments: [], alignmentGuides: [] };
  }

  const aContainsB =
    a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom;
  const bContainsA =
    b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom;

  if (aContainsB || bContainsA) {
    return buildContained(a, b);
  }

  const hOverlap = a.left < b.right && b.left < a.right;
  const vOverlap = a.top < b.bottom && b.top < a.bottom;

  if (hOverlap && vOverlap) {
    // Partial overlap (neither contains). Fall back to inset reading —
    // the four same-side gaps still make sense as a rough overlap
    // breakdown and avoid an empty render.
    return buildContained(a, b);
  }
  if (hOverlap) return buildVerticalGap(a, b);
  if (vOverlap) return buildHorizontalGap(a, b);
  return buildDiagonal(a, b);
}
