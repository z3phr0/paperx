/**
 * CommentAnnotations — priority-colored chrome + teardrop pin rendered
 * on every alive commented element while the user is in Comment mode.
 *
 * Source: v0.13.0 design handoff (paperx-app.jsx#CommentAnnotationDemo).
 * Read-only decoration; the visible affordance is the pin badge —
 * clicking it scrolls the element into view and fires the LocateFlash
 * pulse the same way the panel's Locate icon does.
 *
 * Visibility: `mode === 'comment'`. Off in other modes so design /
 * ruler chrome (selection handles, hover tooltip, etc.) doesn't fight
 * with persistent priority borders.
 *
 * Rect tracking: one window scroll + resize listener, rAF-batched,
 * walks every alive comment target. WeakRef deref + document.contains
 * filter out elements the user has since removed from the DOM.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { createPortal } from 'react-dom';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { CommentStore } from '@/shared/stores/CommentStore';
import {
  COMMENT_PRI_MAP,
  type CommentPriority,
  type PaperxComment,
} from '@/shared/types/comments';
import { usePortalContainer } from '@/shared/ui/portal';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  commentStore: CommentStore;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AliveEntry {
  comment: PaperxComment;
  el: HTMLElement;
  rect: Rect;
}

function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

const AnnotationChrome: React.FC<{
  rect: Rect;
  priority: CommentPriority;
  active: boolean;
  onPinClick: () => void;
}> = ({ rect, priority, active, onPinClick }) => {
  const c = COMMENT_PRI_MAP[priority];
  const borderWidth = active ? 1.75 : 1.25;
  const shadow = active ? `0 8px 24px ${c.dot}25` : 'none';
  return (
    <>
      {/* Bounding chrome */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          border: `${borderWidth}px solid ${c.dot}`,
          borderRadius: 4,
          boxShadow: shadow,
          boxSizing: 'border-box',
          pointerEvents: 'none',
          zIndex: 2147483640,
        }}
      />
      {/* Teardrop pin — clickable */}
      <button
        type="button"
        title={`Comment · ${priority}`}
        onClick={(e) => {
          e.stopPropagation();
          onPinClick();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: rect.left + rect.width - 12,
          top: rect.top - 12,
          width: 24,
          height: 24,
          borderRadius: '50% 50% 50% 4px',
          background: c.dot,
          color: '#fff',
          border: 'none',
          display: 'grid',
          placeItems: 'center',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontFamily: 'inherit',
          cursor: 'pointer',
          boxShadow: `0 4px 12px ${c.dot}66, 0 0 0 2px #fff`,
          pointerEvents: 'auto',
          zIndex: 2147483641,
        }}
      >
        {priority}
      </button>
    </>
  );
};

export const CommentAnnotations = observer(
  ({ uiStore, selectionStore, commentStore }: Props) => {
    const portal = usePortalContainer();
    const visible = uiStore.visible && uiStore.mode === 'comment';

    // Re-render trigger on viewport changes; rects are recomputed during
    // render off this counter so we never store stale getBoundingClientRect
    // values across paints.
    const [tick, setTick] = React.useState(0);

    React.useEffect(() => {
      if (!visible) return;
      let raf = 0;
      const onChange = (): void => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setTick((t) => t + 1));
      };
      window.addEventListener('resize', onChange);
      window.addEventListener('scroll', onChange, { passive: true, capture: true });
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onChange);
        window.removeEventListener('scroll', onChange, true);
      };
    }, [visible]);

    if (!visible) return null;
    if (portal == null) return null;
    // Touch the counter so the linter knows we depend on it for re-renders.
    void tick;

    const selected = selectionStore.selected;
    const entries: AliveEntry[] = [];
    for (const c of commentStore.comments) {
      const el = commentStore.getTargetById(c.id);
      if (el == null) continue;
      if (!document.contains(el)) continue;
      entries.push({ comment: c, el, rect: readRect(el) });
    }

    return createPortal(
      <>
        {entries.map(({ comment, el, rect }) => (
          <AnnotationChrome
            key={comment.id}
            rect={rect}
            priority={comment.priority}
            active={selected === el}
            onPinClick={() => {
              el.scrollIntoView({ block: 'center', behavior: 'smooth' });
              uiStore.flashAt(comment.id);
            }}
          />
        ))}
      </>,
      portal,
    );
  },
);
CommentAnnotations.displayName = 'CommentAnnotations';
