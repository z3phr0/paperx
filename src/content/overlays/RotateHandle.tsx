/**
 * RotateHandle — single circular handle above the selected element
 * that rotates the target via `transform: rotate(<deg>)`. Drag = live
 * preview by mutating target.style.transform; mouseup = restore the
 * baseline and route the final transform through StyleEditService so
 * the change lands in the ChangeLog with the correct `before`.
 *
 * Skeleton scope (P3-E):
 *   - Replaces `transform` wholesale on commit. Existing translate /
 *     scale on the element are wiped. Documented; future Phase can
 *     parse-and-recompose if real users complain.
 *   - Existing `rotate(...)` in the inline transform is parsed as
 *     the rotation baseline so subsequent drags compose correctly.
 *   - No keyboard nudge, no snapping to common angles.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { RotateCw } from 'lucide-react';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  styleEdit: IStyleEditService;
}

const HANDLE_PX = 18;
const HANDLE_GAP = 22;
const Z = 2147483641;

interface DragState {
  baseline: string; // target.style.transform at mousedown
  startRotationDeg: number;
  centerX: number;
  centerY: number;
  startMouseAngleRad: number;
}

/** Pull `rotate(...deg)` out of an inline transform string; default 0. */
function parseRotateDeg(transform: string): number {
  if (!transform) return 0;
  const m = transform.match(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*deg\s*\)/);
  return m ? Number.parseFloat(m[1]!) : 0;
}

/** Angle between mouse and element center, with "straight up" as 0. */
function mouseAngleRad(centerX: number, centerY: number, mx: number, my: number): number {
  return Math.atan2(mx - centerX, -(my - centerY));
}

export const RotateHandle = observer(({ uiStore, selectionStore, styleEdit }: Props) => {
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  dragRef.current = drag;

  const target = selectionStore.selected;
  const rect = selectionStore.selectedRect;
  const visible =
    uiStore.visible && uiStore.mode === 'design' && target != null && rect != null;

  React.useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      const t = selectionStore.selected;
      if (!d || !t) return;
      e.preventDefault();
      const cur = mouseAngleRad(d.centerX, d.centerY, e.clientX, e.clientY);
      const deltaDeg = ((cur - d.startMouseAngleRad) * 180) / Math.PI;
      const next = d.startRotationDeg + deltaDeg;
      t.style.transform = `rotate(${Math.round(next * 10) / 10}deg)`;
    };

    const onUp = (e: MouseEvent) => {
      const d = dragRef.current;
      const t = selectionStore.selected;
      if (!d || !t) {
        setDrag(null);
        return;
      }
      e.preventDefault();
      const preview = t.style.transform;
      // Restore baseline so service reads the correct `before`.
      t.style.transform = d.baseline;
      if (preview && preview !== d.baseline) {
        styleEdit.apply(t, 'transform', preview);
      }
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

  const cx = rect.left + rect.width / 2;
  const cy = rect.top - HANDLE_GAP;

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const baseline = target.style.transform;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    setDrag({
      baseline,
      startRotationDeg: parseRotateDeg(baseline),
      centerX,
      centerY,
      startMouseAngleRad: mouseAngleRad(centerX, centerY, e.clientX, e.clientY),
    });
  };

  return (
    <div aria-hidden style={{ pointerEvents: 'none' }}>
      {/* connector line */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: `${rect.top - HANDLE_GAP + HANDLE_PX / 2}px`,
          left: `${cx - 0.5}px`,
          width: '1px',
          height: `${HANDLE_GAP - HANDLE_PX / 2}px`,
          background: '#2563eb',
          opacity: 0.7,
          zIndex: Z,
          pointerEvents: 'none',
        }}
      />
      <div
        role="button"
        aria-label="Rotate"
        data-testid="paperx-rotate-handle"
        onMouseDown={onMouseDown}
        style={{
          position: 'fixed',
          top: `${cy - HANDLE_PX / 2}px`,
          left: `${cx - HANDLE_PX / 2}px`,
          width: `${HANDLE_PX}px`,
          height: `${HANDLE_PX}px`,
          borderRadius: '50%',
          background: '#ffffff',
          border: '1.5px solid #2563eb',
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: Z,
          cursor: 'grab',
          pointerEvents: 'auto',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      >
        <RotateCw style={{ width: 11, height: 11 }} />
      </div>
    </div>
  );
});
RotateHandle.displayName = 'RotateHandle';
