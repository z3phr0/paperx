/**
 * PickerOverlay — fixed-position outline boxes drawn on top of the host
 * page. Two layers:
 *   - hovered: thin outline that follows the mouse
 *   - selected: solid outline + slightly thicker stroke (sticky)
 *
 * Rendered as `position: fixed` divs with inline geometry so we don't
 * fight Tailwind's JIT for arbitrary values that change every frame.
 * `pointer-events: none` is critical — overlay never swallows input.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { SelectionStore } from '@/shared/stores/SelectionStore';

interface Props {
  store: SelectionStore;
}

// Figma-aligned visual tokens (mirrored verbatim in ResizeHandles and
// RotateHandle — three uses doesn't justify a shared module).
const FIGMA_BLUE = '#18A0FB';
const FIGMA_BLUE_TINT = 'rgba(24, 160, 251, 0.08)';

function rectStyle(rect: DOMRect | null): React.CSSProperties | undefined {
  if (!rect) return undefined;
  // Clamp tiny rects so the outline is still visible when the target is
  // near-zero-sized (collapsed margins, empty inline elements).
  return {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 2)}px`,
    height: `${Math.max(rect.height, 2)}px`,
    pointerEvents: 'none',
    zIndex: 2147483640,
  };
}

export const PickerOverlay = observer(({ store }: Props) => {
  const hoveredStyle = rectStyle(store.hoveredRect);
  const selectedStyle = rectStyle(store.selectedRect);
  return (
    <>
      {hoveredStyle && (!store.selected || store.hovered !== store.selected) && (
        <div
          aria-hidden
          style={{
            ...hoveredStyle,
            border: `1px solid ${FIGMA_BLUE}`,
            background: FIGMA_BLUE_TINT,
            borderRadius: '2px',
            transition: 'top 60ms linear, left 60ms linear, width 60ms linear, height 60ms linear',
          }}
        />
      )}
      {selectedStyle && (
        <div
          aria-hidden
          style={{
            ...selectedStyle,
            border: `1px solid ${FIGMA_BLUE}`,
            borderRadius: '2px',
          }}
        />
      )}
    </>
  );
});
PickerOverlay.displayName = 'PickerOverlay';
