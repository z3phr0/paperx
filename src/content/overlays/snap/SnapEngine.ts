/**
 * SnapEngine — Figma-style edge / center alignment snap detection.
 *
 * Performance contract (load-bearing — see plan p3-c):
 *   - `collectCandidates()` runs ONCE per drag, in mousedown. Never on
 *     mousemove.
 *   - DOM traversal is exactly: parent + parent's direct children +
 *     grandparent + grandparent's direct children. No further climbing,
 *     no `querySelectorAll('*')`, no descendant scans.
 *   - Final candidate list is capped at MAX_CANDIDATES (20). Order
 *     priority: siblings → uncles → parent → grandparent.
 *   - `findSnaps()` is O(N × 9) per axis — worst case 20 × 9 × 2 = 360
 *     subtractions per mousemove. Sub-millisecond.
 *
 * Out of scope (per plan):
 *   - position-aware snap (we only snap right/bottom + hCenter/vCenter
 *     because ResizeHandles' current model doesn't reposition the
 *     element; left/top are anchors).
 *   - gutter / equal-spacing guides.
 *   - candidate caching across drags.
 */

const PAPERX_HOST_TAG = 'paperx-root';
const MIN_RECT_PX = 4;
const MAX_CANDIDATES = 20;
const DEFAULT_THRESHOLD_PX = 4;

export interface SnapCandidate {
  rect: DOMRect;
  source: 'sibling' | 'uncle' | 'parent' | 'grandparent';
}

export interface ProposedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SnapResult {
  /** Snapped width when the X axis was requested + something snapped. */
  snappedWidth: number | null;
  snappedHeight: number | null;
  /** Viewport X of the active vertical guide line, if any. */
  guideX: number | null;
  /** Viewport Y of the active horizontal guide line, if any. */
  guideY: number | null;
}

export interface AxisMask {
  x: boolean;
  y: boolean;
}

function inViewport(r: DOMRect): boolean {
  return r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
}

function bigEnough(r: DOMRect): boolean {
  return r.width >= MIN_RECT_PX && r.height >= MIN_RECT_PX;
}

function isPaperxDescendant(el: Element): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (cur.tagName?.toLowerCase() === PAPERX_HOST_TAG) return true;
    cur = cur.parentElement;
  }
  return false;
}

function pushCandidate(
  out: SnapCandidate[],
  el: Element | null,
  source: SnapCandidate['source'],
  exclude: Set<Element>,
): void {
  if (!el || exclude.has(el)) return;
  if (!(el instanceof HTMLElement)) return;
  if (isPaperxDescendant(el)) return;
  const rect = el.getBoundingClientRect();
  if (!inViewport(rect) || !bigEnough(rect)) return;
  out.push({ rect, source });
  exclude.add(el);
}

export function collectCandidates(target: HTMLElement): SnapCandidate[] {
  const exclude = new Set<Element>([target]);
  const out: SnapCandidate[] = [];
  const parent = target.parentElement;
  const grandparent = parent?.parentElement ?? null;

  // Pass 1: siblings (highest priority).
  if (parent) {
    for (let i = 0; i < parent.children.length && out.length < MAX_CANDIDATES; i += 1) {
      pushCandidate(out, parent.children[i] ?? null, 'sibling', exclude);
    }
  }
  // Pass 2: uncles (children of grandparent that aren't the parent).
  if (grandparent) {
    for (let i = 0; i < grandparent.children.length && out.length < MAX_CANDIDATES; i += 1) {
      const c = grandparent.children[i] ?? null;
      if (c === parent) continue;
      pushCandidate(out, c, 'uncle', exclude);
    }
  }
  // Pass 3: parent + grandparent themselves (anchor boxes).
  pushCandidate(out, parent, 'parent', exclude);
  pushCandidate(out, grandparent, 'grandparent', exclude);

  return out.slice(0, MAX_CANDIDATES);
}

interface AxisCandidateLines {
  x: number[]; // candidate.left, candidate.right, candidate.hCenter
  y: number[]; // candidate.top, candidate.bottom, candidate.vCenter
}

function candidateLines(c: SnapCandidate): AxisCandidateLines {
  const r = c.rect;
  return {
    x: [r.left, r.right, r.left + r.width / 2],
    y: [r.top, r.bottom, r.top + r.height / 2],
  };
}

/**
 * For one moving edge value `mv` (e.g. proposed.right) compare against
 * each candidate vertical line; return the best hit (smallest |delta|)
 * within threshold, else null.
 */
function bestSnap(
  mv: number,
  lines: number[],
  threshold: number,
): { line: number; delta: number } | null {
  let best: { line: number; delta: number } | null = null;
  for (const l of lines) {
    const delta = mv - l;
    const abs = Math.abs(delta);
    if (abs <= threshold && (best === null || abs < Math.abs(best.delta))) {
      best = { line: l, delta };
    }
  }
  return best;
}

export function findSnaps(
  proposed: ProposedRect,
  candidates: readonly SnapCandidate[],
  axes: AxisMask = { x: true, y: true },
  thresholdPx: number = DEFAULT_THRESHOLD_PX,
): SnapResult {
  const right = proposed.left + proposed.width;
  const bottom = proposed.top + proposed.height;
  const hCenter = proposed.left + proposed.width / 2;
  const vCenter = proposed.top + proposed.height / 2;

  // Per-axis: among all candidates, pick the closest match between
  //   {right, hCenter} on X, {bottom, vCenter} on Y
  // and a candidate's three lines.
  let bestX: { line: number; targetIs: 'right' | 'hCenter' } | null = null;
  let bestY: { line: number; targetIs: 'bottom' | 'vCenter' } | null = null;

  for (const c of candidates) {
    const lines = candidateLines(c);

    if (axes.x) {
      const r = bestSnap(right, lines.x, thresholdPx);
      const h = bestSnap(hCenter, lines.x, thresholdPx);
      const candidateBest =
        r && h
          ? Math.abs(r.delta) <= Math.abs(h.delta)
            ? { line: r.line, targetIs: 'right' as const, delta: r.delta }
            : { line: h.line, targetIs: 'hCenter' as const, delta: h.delta }
          : r
            ? { line: r.line, targetIs: 'right' as const, delta: r.delta }
            : h
              ? { line: h.line, targetIs: 'hCenter' as const, delta: h.delta }
              : null;
      if (candidateBest) {
        if (
          bestX === null ||
          Math.abs(candidateBest.delta) <
            Math.abs(
              bestX.targetIs === 'right' ? right - bestX.line : hCenter - bestX.line,
            )
        ) {
          bestX = { line: candidateBest.line, targetIs: candidateBest.targetIs };
        }
      }
    }

    if (axes.y) {
      const b = bestSnap(bottom, lines.y, thresholdPx);
      const v = bestSnap(vCenter, lines.y, thresholdPx);
      const candidateBest =
        b && v
          ? Math.abs(b.delta) <= Math.abs(v.delta)
            ? { line: b.line, targetIs: 'bottom' as const, delta: b.delta }
            : { line: v.line, targetIs: 'vCenter' as const, delta: v.delta }
          : b
            ? { line: b.line, targetIs: 'bottom' as const, delta: b.delta }
            : v
              ? { line: v.line, targetIs: 'vCenter' as const, delta: v.delta }
              : null;
      if (candidateBest) {
        if (
          bestY === null ||
          Math.abs(candidateBest.delta) <
            Math.abs(
              bestY.targetIs === 'bottom' ? bottom - bestY.line : vCenter - bestY.line,
            )
        ) {
          bestY = { line: candidateBest.line, targetIs: candidateBest.targetIs };
        }
      }
    }
  }

  let snappedWidth: number | null = null;
  let snappedHeight: number | null = null;
  let guideX: number | null = null;
  let guideY: number | null = null;

  if (bestX) {
    if (bestX.targetIs === 'right') {
      snappedWidth = bestX.line - proposed.left;
    } else {
      // hCenter = left + width/2 → width = 2 × (guideX - left)
      snappedWidth = 2 * (bestX.line - proposed.left);
    }
    if (snappedWidth >= 1) {
      guideX = bestX.line;
    } else {
      snappedWidth = null;
    }
  }
  if (bestY) {
    if (bestY.targetIs === 'bottom') {
      snappedHeight = bestY.line - proposed.top;
    } else {
      snappedHeight = 2 * (bestY.line - proposed.top);
    }
    if (snappedHeight >= 1) {
      guideY = bestY.line;
    } else {
      snappedHeight = null;
    }
  }

  return { snappedWidth, snappedHeight, guideX, guideY };
}
