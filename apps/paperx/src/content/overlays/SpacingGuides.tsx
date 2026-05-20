/**
 * SpacingGuides — Figma-style margin / padding / gap visualization.
 *
 * Renders translucent orange bands over the selected element's
 * margin and padding areas, plus a small chip showing the parent
 * container's `gap` when the parent uses flex / grid. Active in
 * comment mode alongside CommentGuides.
 *
 *   margin: rgba(255, 165, 30, 0.18)  ←  outer 4 bands
 *   padding: rgba(255, 165, 30, 0.28) ←  inner 4 bands
 *   labels: rgba(217, 119, 6, 1)      ←  amber-600 ish
 *
 * Recompute on selection change + scroll + resize, like
 * CommentGuides. We don't observe layout mutations on the host page
 * (out of scope for a review visualization).
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
}

interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface Spacing {
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
  parentGap: { row: number; column: number; isFlexish: boolean };
}

function readBox(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    left: r.left,
    width: r.width,
    height: r.height,
  };
}

function px(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function readSpacing(el: HTMLElement): Spacing {
  const cs = getComputedStyle(el);
  const margin = {
    top: px(cs.marginTop),
    right: px(cs.marginRight),
    bottom: px(cs.marginBottom),
    left: px(cs.marginLeft),
  };
  const padding = {
    top: px(cs.paddingTop),
    right: px(cs.paddingRight),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
  };

  const parent = el.parentElement;
  let parentGap = { row: 0, column: 0, isFlexish: false };
  if (parent) {
    const pcs = getComputedStyle(parent);
    const display = pcs.display;
    const isFlexish =
      display === 'flex' ||
      display === 'inline-flex' ||
      display === 'grid' ||
      display === 'inline-grid';
    if (isFlexish) {
      parentGap = {
        row: px(pcs.rowGap || pcs.gap),
        column: px(pcs.columnGap || pcs.gap),
        isFlexish: true,
      };
    }
  }

  return { margin, padding, parentGap };
}

const ORANGE_FILL_OUTER = 'rgba(255, 165, 30, 0.18)';
const ORANGE_FILL_INNER = 'rgba(255, 165, 30, 0.28)';
const ORANGE_LABEL = 'rgb(217, 119, 6)';

const labelStyle: React.CSSProperties = {
  position: 'absolute',
  fontSize: 10,
  fontFamily: 'ui-monospace, SF Mono, monospace',
  color: ORANGE_LABEL,
  pointerEvents: 'none',
  lineHeight: 1,
  padding: '1px 3px',
  background: 'rgba(255, 247, 237, 0.85)',
  borderRadius: 2,
  whiteSpace: 'nowrap',
};

export const SpacingGuides = observer(({ uiStore, selectionStore }: Props) => {
  const target = selectionStore.selected;
  const visible = uiStore.visible && uiStore.mode === 'comment' && target != null;

  const [box, setBox] = React.useState<Box | null>(target ? readBox(target) : null);
  const [spacing, setSpacing] = React.useState<Spacing | null>(target ? readSpacing(target) : null);
  React.useEffect(() => {
    if (!target) {
      setBox(null);
      setSpacing(null);
      return;
    }
    const update = () => {
      setBox(readBox(target));
      setSpacing(readSpacing(target));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [target]);

  if (!visible || !box || !spacing) return null;
  const { margin: m, padding: p, parentGap } = spacing;

  return (
    <div
      data-testid="paperx-spacing-guides"
      aria-hidden
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483639 }}
    >
      {/* === margin bands (outside the bbox) === */}
      {m.top > 0 && (
        <div
          data-testid="paperx-spacing-margin-top"
          style={{
            position: 'fixed',
            left: box.left,
            top: box.top - m.top,
            width: box.width,
            height: m.top,
            background: ORANGE_FILL_OUTER,
          }}
        >
          <span style={{ ...labelStyle, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            {Math.round(m.top)}
          </span>
        </div>
      )}
      {m.right > 0 && (
        <div
          data-testid="paperx-spacing-margin-right"
          style={{
            position: 'fixed',
            left: box.right,
            top: box.top,
            width: m.right,
            height: box.height,
            background: ORANGE_FILL_OUTER,
          }}
        >
          <span style={{ ...labelStyle, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            {Math.round(m.right)}
          </span>
        </div>
      )}
      {m.bottom > 0 && (
        <div
          data-testid="paperx-spacing-margin-bottom"
          style={{
            position: 'fixed',
            left: box.left,
            top: box.bottom,
            width: box.width,
            height: m.bottom,
            background: ORANGE_FILL_OUTER,
          }}
        >
          <span style={{ ...labelStyle, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            {Math.round(m.bottom)}
          </span>
        </div>
      )}
      {m.left > 0 && (
        <div
          data-testid="paperx-spacing-margin-left"
          style={{
            position: 'fixed',
            left: box.left - m.left,
            top: box.top,
            width: m.left,
            height: box.height,
            background: ORANGE_FILL_OUTER,
          }}
        >
          <span style={{ ...labelStyle, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            {Math.round(m.left)}
          </span>
        </div>
      )}

      {/* === padding bands (inside the bbox) === */}
      {p.top > 0 && (
        <div
          data-testid="paperx-spacing-padding-top"
          style={{
            position: 'fixed',
            left: box.left,
            top: box.top,
            width: box.width,
            height: p.top,
            background: ORANGE_FILL_INNER,
          }}
        >
          <span style={{ ...labelStyle, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            {Math.round(p.top)}
          </span>
        </div>
      )}
      {p.right > 0 && (
        <div
          data-testid="paperx-spacing-padding-right"
          style={{
            position: 'fixed',
            left: box.right - p.right,
            top: box.top,
            width: p.right,
            height: box.height,
            background: ORANGE_FILL_INNER,
          }}
        >
          <span style={{ ...labelStyle, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            {Math.round(p.right)}
          </span>
        </div>
      )}
      {p.bottom > 0 && (
        <div
          data-testid="paperx-spacing-padding-bottom"
          style={{
            position: 'fixed',
            left: box.left,
            top: box.bottom - p.bottom,
            width: box.width,
            height: p.bottom,
            background: ORANGE_FILL_INNER,
          }}
        >
          <span style={{ ...labelStyle, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            {Math.round(p.bottom)}
          </span>
        </div>
      )}
      {p.left > 0 && (
        <div
          data-testid="paperx-spacing-padding-left"
          style={{
            position: 'fixed',
            left: box.left,
            top: box.top,
            width: p.left,
            height: box.height,
            background: ORANGE_FILL_INNER,
          }}
        >
          <span style={{ ...labelStyle, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            {Math.round(p.left)}
          </span>
        </div>
      )}

      {/* === parent gap chip (if parent is flex/grid) === */}
      {parentGap.isFlexish && (parentGap.row > 0 || parentGap.column > 0) && (
        <div
          data-testid="paperx-spacing-parent-gap"
          style={{
            position: 'fixed',
            left: box.right + 8,
            top: box.top - 8,
            background: 'rgba(255, 247, 237, 0.95)',
            border: `1px solid ${ORANGE_LABEL}`,
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 10,
            fontFamily: 'ui-monospace, SF Mono, monospace',
            color: ORANGE_LABEL,
            whiteSpace: 'nowrap',
          }}
        >
          gap {parentGap.row === parentGap.column
            ? `${Math.round(parentGap.row)}`
            : `${Math.round(parentGap.row)}/${Math.round(parentGap.column)}`}
        </div>
      )}
    </div>
  );
});
SpacingGuides.displayName = 'SpacingGuides';
