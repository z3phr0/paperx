/**
 * ResizeHandles — 8 draggable squares around the selected element
 * (4 corners + 4 edge midpoints). Drag → live preview by mutating
 * `target.style.width/height` directly. Mouseup → restore the
 * baseline inline values, then route the final size through
 * StyleEditService.apply() so the change lands in the ChangeLog
 * exactly once with the correct `before` (the pre-drag value).
 *
 * Skeleton-level scope (P3-D):
 *   - All 8 handles only mutate width/height. We don't reposition
 *     the element (no `top/left` adjustments). For position:static
 *     blocks this is fine; for absolutely-positioned elements the
 *     N/W handles will appear to "shrink toward bottom-right",
 *     which is documented and acceptable for sanity. Future Phase
 *     can layer position-aware drag on top.
 *   - No snapping. No multi-select. No keyboard nudge.
 *
 * Visible iff `UIStore.visible && mode === 'design' && selected != null`.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  styleEdit: IStyleEditService;
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const HANDLE_PX = 10;
const MIN_PX = 1;
const Z = 2147483641;

interface Anchor {
  /** Center coordinate inside the element bounding box (0..1). */
  cx: number;
  cy: number;
  cursor: string;
  testid: string;
}
const ANCHORS: Record<Handle, Anchor> = {
  nw: { cx: 0, cy: 0, cursor: 'nwse-resize', testid: 'paperx-resize-nw' },
  n:  { cx: 0.5, cy: 0, cursor: 'ns-resize', testid: 'paperx-resize-n' },
  ne: { cx: 1, cy: 0, cursor: 'nesw-resize', testid: 'paperx-resize-ne' },
  e:  { cx: 1, cy: 0.5, cursor: 'ew-resize', testid: 'paperx-resize-e' },
  se: { cx: 1, cy: 1, cursor: 'nwse-resize', testid: 'paperx-resize-se' },
  s:  { cx: 0.5, cy: 1, cursor: 'ns-resize', testid: 'paperx-resize-s' },
  sw: { cx: 0, cy: 1, cursor: 'nesw-resize', testid: 'paperx-resize-sw' },
  w:  { cx: 0, cy: 0.5, cursor: 'ew-resize', testid: 'paperx-resize-w' },
};

interface DragState {
  handle: Handle;
  /** Inline-style baseline so commit can revert before applying. */
  baseline: { width: string; height: string };
  startRect: DOMRect;
  startMouse: { x: number; y: number };
}

function deltaToSize(handle: Handle, startW: number, startH: number, dx: number, dy: number): { w: number; h: number } {
  const wDelta = handle.includes('e') ? dx : handle.includes('w') ? -dx : 0;
  const hDelta = handle.includes('s') ? dy : handle.includes('n') ? -dy : 0;
  return {
    w: Math.max(MIN_PX, startW + wDelta),
    h: Math.max(MIN_PX, startH + hDelta),
  };
}

export const ResizeHandles = observer(({ uiStore, selectionStore, styleEdit }: Props) => {
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  dragRef.current = drag;

  // Whether the rect should be tracked. Hooks order requires we read
  // observable values BEFORE any early return.
  const target = selectionStore.selected;
  const rect = selectionStore.selectedRect;
  const visible =
    uiStore.visible && uiStore.mode === 'design' && target != null && rect != null;

  // Global mousemove / mouseup listeners only when actively dragging.
  React.useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      const t = selectionStore.selected;
      if (!d || !t) return;
      e.preventDefault();
      const dx = e.clientX - d.startMouse.x;
      const dy = e.clientY - d.startMouse.y;
      const { w, h } = deltaToSize(d.handle, d.startRect.width, d.startRect.height, dx, dy);
      // Live preview — raw mutation so service is unaware. Will be
      // reverted before commit.
      t.style.width = `${Math.round(w)}px`;
      t.style.height = `${Math.round(h)}px`;
    };

    const onUp = (e: MouseEvent) => {
      const d = dragRef.current;
      const t = selectionStore.selected;
      if (!d || !t) {
        setDrag(null);
        return;
      }
      e.preventDefault();
      const previewWidth = t.style.width;
      const previewHeight = t.style.height;
      // Restore baseline so the service reads the correct `before`.
      t.style.width = d.baseline.width;
      t.style.height = d.baseline.height;
      const widthChanged = previewWidth && previewWidth !== d.baseline.width;
      const heightChanged = previewHeight && previewHeight !== d.baseline.height;
      // Width-only handles are e/w; height-only are n/s; corners are both.
      if (d.handle.includes('e') || d.handle.includes('w')) {
        if (widthChanged) styleEdit.apply(t, 'width', previewWidth);
      }
      if (d.handle.includes('n') || d.handle.includes('s')) {
        if (heightChanged) styleEdit.apply(t, 'height', previewHeight);
      }
      // Refresh cached rects so the handles repaint at the new bounds.
      selectionStore.refresh();
      setDrag(null);
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
    };
  }, [drag, selectionStore, styleEdit]);

  if (!visible || !target || !rect) return null;

  const beginDrag = (handle: Handle) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({
      handle,
      baseline: {
        width: target.style.width,
        height: target.style.height,
      },
      startRect: target.getBoundingClientRect(),
      startMouse: { x: e.clientX, y: e.clientY },
    });
  };

  return (
    <div aria-hidden data-testid="paperx-resize-handles" style={{ pointerEvents: 'none' }}>
      {HANDLES.map((h) => {
        const a = ANCHORS[h];
        const cx = rect.left + rect.width * a.cx;
        const cy = rect.top + rect.height * a.cy;
        return (
          <div
            key={h}
            role="button"
            aria-label={`Resize ${h}`}
            data-testid={a.testid}
            onMouseDown={beginDrag(h)}
            style={{
              position: 'fixed',
              top: `${cy - HANDLE_PX / 2}px`,
              left: `${cx - HANDLE_PX / 2}px`,
              width: `${HANDLE_PX}px`,
              height: `${HANDLE_PX}px`,
              background: '#ffffff',
              border: '1.5px solid #2563eb',
              borderRadius: 2,
              zIndex: Z,
              cursor: a.cursor,
              pointerEvents: 'auto',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }}
          />
        );
      })}
    </div>
  );
});
ResizeHandles.displayName = 'ResizeHandles';
