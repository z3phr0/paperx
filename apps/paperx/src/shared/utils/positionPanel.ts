/**
 * Pure positioning strategy for the DesignPanel V2 (and any other side
 * panel that needs to dodge a selected element + already-floating
 * overlays). Lives outside React / MobX so it's trivially unit-testable
 * and re-usable from anywhere.
 *
 * Strategy (tried in order until one survives viewport + avoid checks):
 *   1. RIGHT  of the target with a `gap + handlePad` clearance for the
 *              east-edge resize handles.
 *   2. LEFT   of the target, same clearance.
 *   3. BELOW  the target, full width drop. Vertically below means the
 *              panel anchors at target.bottom + gap + handlePad.
 *   4. ABOVE  the target, same shape.
 *   5. FALLBACK: viewport right edge — by user-chosen design. Allowed to
 *      overlap the target when nothing else fits; the user has the
 *      toolbar drag as an escape hatch.
 *
 * The final result is always clamped inside [margin, viewportEdge - size
 * - margin] so the panel never slips behind a viewport boundary.
 */

export interface Bbox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PanelPosition {
  left: number;
  top: number;
}

export interface PickPanelPositionArgs {
  /** Selected element's bounding rect. Null = no preferred anchor → fallback. */
  targetRect: DOMRect | null;
  panelSize: { width: number; height: number };
  viewport: { width: number; height: number };
  /** Other floating UI to dodge: toolbar pill, hover tooltip, etc. */
  avoid: Bbox[];
  /** Visual gap between target and panel, in px. */
  gap: number;
  /** Extra clearance for resize handles (E / NE / SE typically). */
  handlePad: number;
  /** Margin from the viewport edge. */
  margin: number;
}

/** Minimum panel height before a candidate is considered unusable. */
const MIN_PANEL_HEIGHT = 160;

function clamp(n: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export function rectsOverlap(a: Bbox, b: Bbox): boolean {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
}

/** Box the panel will occupy if placed at `pos` with `width × fittedHeight`. */
function boxAt(pos: PanelPosition, width: number, fittedHeight: number): Bbox {
  return {
    left: pos.left,
    top: pos.top,
    right: pos.left + width,
    bottom: pos.top + fittedHeight,
  };
}

export function pickPanelPosition(args: PickPanelPositionArgs): PanelPosition {
  const { targetRect, panelSize, viewport, avoid, gap, handlePad, margin } = args;

  // Horizontal viewport check is hard (panel is fixed-width); vertical is
  // soft (the dv-scroll inside handles overflow, so a shorter panel is
  // acceptable as long as it clears MIN_PANEL_HEIGHT).
  const fitsHoriz = (left: number): boolean =>
    left >= margin && left + panelSize.width <= viewport.width - margin;
  const usableHeight = (top: number): number =>
    Math.min(panelSize.height, viewport.height - top - margin);

  // No selection → park at viewport right edge (matches the legacy default).
  if (targetRect == null) {
    const left = clamp(
      viewport.width - panelSize.width - margin,
      margin,
      viewport.width - panelSize.width - margin,
    );
    return { left, top: margin };
  }

  const clearance = gap + handlePad;
  // Vertically align top with the target's top by default.
  const sideTop = clamp(
    targetRect.top,
    margin,
    Math.max(margin, viewport.height - MIN_PANEL_HEIGHT - margin),
  );
  // For below/above placements, center horizontally on the target.
  const dropLeftRaw = targetRect.left + targetRect.width / 2 - panelSize.width / 2;

  const candidates: PanelPosition[] = [
    // 1. RIGHT
    { left: targetRect.right + clearance, top: sideTop },
    // 2. LEFT
    { left: targetRect.left - panelSize.width - clearance, top: sideTop },
    // 3. BELOW
    { left: dropLeftRaw, top: targetRect.bottom + clearance },
    // 4. ABOVE
    {
      left: dropLeftRaw,
      top: targetRect.top - panelSize.height - clearance,
    },
  ];

  const targetBox: Bbox = {
    left: targetRect.left,
    top: targetRect.top,
    right: targetRect.right,
    bottom: targetRect.bottom,
  };

  for (const c of candidates) {
    // Horizontal: hard requirement — panel must fully fit horizontally
    // at this candidate's `left` (no clamp; we'd push the panel onto a
    // wrong side).
    if (!fitsHoriz(c.left)) continue;
    // Vertical: clamp top into viewport, then compute the actual height
    // that fits at this top. If it's below the usable minimum, skip.
    const top = clamp(
      c.top,
      margin,
      Math.max(margin, viewport.height - MIN_PANEL_HEIGHT - margin),
    );
    const height = usableHeight(top);
    if (height < MIN_PANEL_HEIGHT) continue;

    const candidateBox = boxAt({ left: c.left, top }, panelSize.width, height);

    // Avoid: don't overlap toolbar / hover tooltip / etc.
    if (avoid.some((a) => rectsOverlap(candidateBox, a))) continue;
    // Don't overlap the target itself (the whole point of the side-step).
    if (rectsOverlap(candidateBox, targetBox)) continue;

    return { left: c.left, top };
  }

  // FALLBACK: viewport right edge. Allowed to overlap target per the
  // user's design call — the toolbar drag is the manual escape hatch.
  return {
    left: clamp(
      viewport.width - panelSize.width - margin,
      margin,
      viewport.width - panelSize.width - margin,
    ),
    top: margin,
  };
}
