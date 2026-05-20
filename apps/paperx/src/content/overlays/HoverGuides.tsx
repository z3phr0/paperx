/**
 * HoverGuides — Figma-style full-viewport dashed lines extending from
 * each edge of the currently HOVERED element. Active in design / ruler
 * / comment modes; skips `transition` and `mode === null`.
 *
 * Renders 4 fixed-position 1px divs (top / bottom horizontal, left /
 * right vertical) with `border-{top,left}: 1px dashed #F24E1E`. We
 * avoid SVG for consistency with the rest of the overlay family — a
 * handful of divs is fewer rendering hops on hot-path scrolls (see
 * CommentGuides.tsx:76-77).
 *
 * Skipped when `hovered === selected` (self-hover noise) or when the
 * picker isn't active. Z-index 2147483639 sits one below PickerOverlay's
 * outlines so the selected/hovered boxes draw on top of the guides.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';

const FIGMA_PINK = '#F24E1E';
const Z = 2147483639;

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
}

const GUIDE_MODES: ReadonlySet<string> = new Set(['design', 'ruler', 'comment']);

export const HoverGuides = observer(({ uiStore, selectionStore }: Props) => {
  const visible =
    uiStore.visible &&
    uiStore.mode != null &&
    GUIDE_MODES.has(uiStore.mode) &&
    selectionStore.hovered != null &&
    selectionStore.hovered !== selectionStore.selected;

  const rect = selectionStore.hoveredRect;
  if (!visible || !rect) return null;

  const lineBase: React.CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: Z,
    transition: 'top 60ms linear, left 60ms linear',
  };

  return (
    <>
      {/* top edge — horizontal line spanning full viewport */}
      <div
        aria-hidden
        data-testid="paperx-hover-guide-top"
        style={{
          ...lineBase,
          top: `${rect.top - 0.5}px`,
          left: 0,
          right: 0,
          height: 0,
          borderTop: `1px dashed ${FIGMA_PINK}`,
        }}
      />
      {/* bottom edge */}
      <div
        aria-hidden
        data-testid="paperx-hover-guide-bottom"
        style={{
          ...lineBase,
          top: `${rect.bottom - 0.5}px`,
          left: 0,
          right: 0,
          height: 0,
          borderTop: `1px dashed ${FIGMA_PINK}`,
        }}
      />
      {/* left edge — vertical line spanning full viewport */}
      <div
        aria-hidden
        data-testid="paperx-hover-guide-left"
        style={{
          ...lineBase,
          left: `${rect.left - 0.5}px`,
          top: 0,
          bottom: 0,
          width: 0,
          borderLeft: `1px dashed ${FIGMA_PINK}`,
        }}
      />
      {/* right edge */}
      <div
        aria-hidden
        data-testid="paperx-hover-guide-right"
        style={{
          ...lineBase,
          left: `${rect.right - 0.5}px`,
          top: 0,
          bottom: 0,
          width: 0,
          borderLeft: `1px dashed ${FIGMA_PINK}`,
        }}
      />
    </>
  );
});
HoverGuides.displayName = 'HoverGuides';
