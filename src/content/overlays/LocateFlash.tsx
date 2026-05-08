/**
 * LocateFlash — pulsing visual cue rendered over a commented element
 * when the reviewer clicks the Locate button. Replaces the previous
 * `el.style.outline` direct write (which host-page CSS could
 * override).
 *
 * Mounts a fixed-position div sized to the comment target's bbox,
 * with a high z-index above the comment panel + a 1.8s box-shadow
 * keyframe pulse. UIStore.flashCommentId drives visibility; the
 * store auto-clears via setTimeout, so this component only renders
 * when something is actively being highlighted.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { CommentStore } from '@/shared/stores/CommentStore';

interface Props {
  uiStore: UIStore;
  commentStore: CommentStore;
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

const PULSE_KEYFRAMES = `
@keyframes paperx-locate-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7), 0 0 0 0 rgba(244, 63, 94, 0.4);
  }
  70% {
    box-shadow: 0 0 0 14px rgba(244, 63, 94, 0), 0 0 0 28px rgba(244, 63, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(244, 63, 94, 0), 0 0 0 0 rgba(244, 63, 94, 0);
  }
}
`;

export const LocateFlash = observer(({ uiStore, commentStore }: Props) => {
  const id = uiStore.flashCommentId;
  const target = id ? commentStore.getTargetById(id) : null;

  // Track rect locally so a window scroll during the 1.8s pulse keeps
  // the highlight glued to the element.
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

  if (!id || !target || !rect) return null;

  return (
    <>
      <style>{PULSE_KEYFRAMES}</style>
      <div
        data-testid="paperx-locate-flash"
        aria-hidden
        style={{
          position: 'fixed',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          border: '2px solid rgb(244, 63, 94)',
          borderRadius: 4,
          boxSizing: 'border-box',
          pointerEvents: 'none',
          zIndex: 2147483646,
          animation: 'paperx-locate-pulse 1.8s ease-out 1',
        }}
      />
    </>
  );
});
LocateFlash.displayName = 'LocateFlash';
