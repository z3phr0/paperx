/**
 * Distance measurement between two DOMRects, Figma style.
 *
 * Returns four signed gaps relative to A's edges. The convention matches
 * what Figma displays:
 *
 *   - `top`    = B.top - A.top      (positive = B's top is inside A; negative = B above A)
 *   - `right`  = A.right - B.right  (positive = B's right inside A; negative = B juts past A)
 *   - `bottom` = A.bottom - B.bottom (positive = B's bottom inside A)
 *   - `left`   = B.left - A.left    (positive = B's left inside A)
 *
 * When B is contained inside A, all four are positive — they read as
 * inset padding-like distances on each side. When B is outside A in some
 * direction, the corresponding value goes negative; the abs magnitude is
 * still the visual distance to render.
 *
 * Anchor points returned alongside each value tell the consumer where to
 * draw the short connector line and place the label chip. Anchors live
 * on the geometry midpoint between the relevant edges:
 *
 *   - `top` anchor: x at horizontal overlap midpoint, y between A.top and B.top
 *   - `right` anchor: x between A.right and B.right, y at vertical overlap midpoint
 *   - …
 *
 * Caller filters out near-zero values (|value| < 1) to avoid noise.
 */
export interface GapLabel {
  /** Signed pixel gap; abs is displayed. */
  value: number;
  /** Viewport-space anchor for the label's midpoint. */
  x: number;
  y: number;
  /** Orientation hints the consumer to draw a vertical / horizontal connector. */
  orientation: 'horizontal' | 'vertical';
}

export interface DistanceLabels {
  top: GapLabel;
  right: GapLabel;
  bottom: GapLabel;
  left: GapLabel;
}

function midX(a: DOMRect, b: DOMRect): number {
  // Horizontal midpoint of the overlap between A and B; falls back to
  // the midpoint between their centers when there is no overlap.
  const overlapLeft = Math.max(a.left, b.left);
  const overlapRight = Math.min(a.right, b.right);
  if (overlapRight > overlapLeft) return (overlapLeft + overlapRight) / 2;
  const aCx = (a.left + a.right) / 2;
  const bCx = (b.left + b.right) / 2;
  return (aCx + bCx) / 2;
}

function midY(a: DOMRect, b: DOMRect): number {
  const overlapTop = Math.max(a.top, b.top);
  const overlapBottom = Math.min(a.bottom, b.bottom);
  if (overlapBottom > overlapTop) return (overlapTop + overlapBottom) / 2;
  const aCy = (a.top + a.bottom) / 2;
  const bCy = (b.top + b.bottom) / 2;
  return (aCy + bCy) / 2;
}

export function computeDistanceLabels(a: DOMRect, b: DOMRect): DistanceLabels {
  const mx = midX(a, b);
  const my = midY(a, b);
  return {
    top: {
      value: b.top - a.top,
      x: mx,
      y: (a.top + b.top) / 2,
      orientation: 'vertical',
    },
    right: {
      value: a.right - b.right,
      x: (a.right + b.right) / 2,
      y: my,
      orientation: 'horizontal',
    },
    bottom: {
      value: a.bottom - b.bottom,
      x: mx,
      y: (a.bottom + b.bottom) / 2,
      orientation: 'vertical',
    },
    left: {
      value: b.left - a.left,
      x: (a.left + b.left) / 2,
      y: my,
      orientation: 'horizontal',
    },
  };
}
