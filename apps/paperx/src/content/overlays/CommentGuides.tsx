/**
 * CommentGuides — Figma-style auxiliary lines around the commented
 * element. Renders only in `comment` mode with a non-null selection.
 *
 * Visual:
 *   - dashed bbox outline (emerald, matches the comment-mode badge)
 *   - 4 extension lines from each edge to the viewport boundary, so
 *     the reviewer can sight-align the bbox against any other element
 *     on screen without measuring
 *
 * Distance / margin / padding / gap visualization is rendered by a
 * sibling overlay (SpacingGuides) so each is independently feature-
 * flaggable. This component owns no `comment.text` rendering — that's
 * still the panel's job.
 *
 * Recompute strategy: on selection change + window resize. We do not
 * observe DOM mutations (the host page may mutate every frame and the
 * overhead isn't worth it for a review-mode visualizer).
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export const CommentGuides = observer(({ uiStore, selectionStore }: Props) => {
  const target = selectionStore.selected;
  const visible = uiStore.visible && uiStore.mode === 'comment' && target != null;

  // Recompute the bbox rect on selection changes + window resize. We
  // also tick on scroll so the dashed frame follows scrolling pages.
  const [rect, setRect] = React.useState<Rect | null>(target ? readRect(target) : null);
  React.useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const update = () => setRect(readRect(target));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [target]);

  if (!visible || !rect) return null;

  // Use rgb(...) literals rather than tailwind utility classes so the
  // inline-style color survives whatever the host page's css cascade
  // wants to do to fixed-position elements.
  const dash = 'rgba(16, 185, 129, 0.85)'; // emerald-500/85
  const extension = 'rgba(16, 185, 129, 0.35)'; // emerald-500/35

  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;

  // Each extension line is a 1-pixel-thick fixed div. We avoid SVG —
  // a handful of divs is fewer rendering hops on hot-path scrolls.
  const extLineStyle: React.CSSProperties = {
    position: 'fixed',
    backgroundColor: extension,
    pointerEvents: 'none',
    zIndex: 2147483640,
  };

  return (
    <div
      data-testid="paperx-comment-guides"
      aria-hidden
      // Wrapper is just a marker for the e2e — actual lines are
      // rendered as fixed-positioned siblings.
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483640 }}
    >
      {/* Dashed bbox outline */}
      <div
        data-testid="paperx-comment-guides-bbox"
        style={{
          position: 'fixed',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          border: `1px dashed ${dash}`,
          boxSizing: 'border-box',
          pointerEvents: 'none',
          zIndex: 2147483641,
        }}
      />
      {/* 4 extension lines — left / right edges to viewport top + bottom,
          top / bottom edges to viewport left + right. */}
      <div style={{ ...extLineStyle, left: rect.left, top: 0, width: 1, height: rect.top }} />
      <div
        style={{
          ...extLineStyle,
          left: rect.left,
          top: bottom,
          width: 1,
          bottom: 0,
          height: 'auto',
        }}
      />
      <div style={{ ...extLineStyle, left: right, top: 0, width: 1, height: rect.top }} />
      <div
        style={{
          ...extLineStyle,
          left: right,
          top: bottom,
          width: 1,
          bottom: 0,
          height: 'auto',
        }}
      />
      {/* Horizontal extensions: top edge → left/right of viewport;
          bottom edge → left/right of viewport. */}
      <div style={{ ...extLineStyle, left: 0, top: rect.top, width: rect.left, height: 1 }} />
      <div
        style={{
          ...extLineStyle,
          left: right,
          top: rect.top,
          right: 0,
          width: 'auto',
          height: 1,
        }}
      />
      <div style={{ ...extLineStyle, left: 0, top: bottom, width: rect.left, height: 1 }} />
      <div
        style={{
          ...extLineStyle,
          left: right,
          top: bottom,
          right: 0,
          width: 'auto',
          height: 1,
        }}
      />
    </div>
  );
});
CommentGuides.displayName = 'CommentGuides';
