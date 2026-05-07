/**
 * ElementPicker — DOM hit-tester used by every interactive mode
 * (design / ruler / comment / layout) since they all need the user
 * to point at a host-page element.
 *
 * Lifecycle:
 *   - Active iff `UIStore.visible`. Closing paperx (× button) is the
 *     only way to free up host-page click handling. Mode switches do
 *     NOT detach the picker — they just swap the side panel.
 *   - mousemove → elementFromPoint → SelectionStore.hover (rAF coalesced)
 *   - click     → SelectionStore.select; preventDefault + stopPropagation
 *                 so we don't trigger host-page handlers (e.g. <a> nav)
 *   - ESC       → clear selection (back to hover-only state)
 *   - scroll/resize/ResizeObserver(selected) → SelectionStore.refresh()
 *
 * Picker NEVER selects elements inside <paperx-root> (our own UI). The
 * filter walks `composedPath()` so it works through Shadow DOM as well as
 * across nested DOM.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';

import { PickerOverlay } from './PickerOverlay';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
}

const PAPERX_HOST_TAG = 'paperx-root';

/** True when the event originates from inside our own shadow tree. */
function isPaperxEvent(e: Event): boolean {
  const path = e.composedPath?.() ?? [];
  for (const node of path) {
    if (node instanceof Element && node.tagName?.toLowerCase() === PAPERX_HOST_TAG) {
      return true;
    }
  }
  return false;
}

/**
 * Reject elements that live inside <paperx-root>. Returns the element as
 * an HTMLElement when it's a host-page node, otherwise null.
 */
function asHostPageElement(el: Element | null): HTMLElement | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  let cur: Element | null = el;
  while (cur) {
    if (cur.tagName?.toLowerCase() === PAPERX_HOST_TAG) return null;
    cur = cur.parentElement;
  }
  return el;
}

export const ElementPicker = observer(({ uiStore, selectionStore }: Props) => {
  const active = uiStore.visible;
  const selected = selectionStore.selected;

  // Window-scoped listeners: hover, click, esc, scroll, resize.
  React.useEffect(() => {
    if (!active) {
      // Switching away from design mode wipes selection state — DesignPanel
      // will unmount and we shouldn't leak hover outlines.
      selectionStore.clear();
      return;
    }

    let rafId: number | null = null;
    let pendingX = 0;
    let pendingY = 0;
    let pendingDirty = false;

    const flushHover = () => {
      rafId = null;
      if (!pendingDirty) return;
      pendingDirty = false;
      const el = document.elementFromPoint(pendingX, pendingY);
      const target = asHostPageElement(el);
      // When the cursor is over our own UI, leave the previous hover
      // outline alone instead of flickering to null.
      if (target) selectionStore.hover(target);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isPaperxEvent(e)) return;
      pendingX = e.clientX;
      pendingY = e.clientY;
      pendingDirty = true;
      if (rafId == null) rafId = requestAnimationFrame(flushHover);
    };

    const onClick = (e: MouseEvent) => {
      if (isPaperxEvent(e)) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = asHostPageElement(el);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      selectionStore.select(target);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isPaperxEvent(e)) return; // panel inputs keep their own ESC affordance
      selectionStore.select(null);
    };

    const onScrollOrResize = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        selectionStore.refresh();
      });
    };

    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize, true);

    return () => {
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize, true);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [active, selectionStore]);

  // ResizeObserver lives in a separate effect keyed on `selected` — when
  // user picks a new element we (un)observe just that node. Kept apart
  // from the listener effect to avoid re-binding window handlers when
  // selection toggles.
  React.useEffect(() => {
    if (!active || !selected) return;
    const ro = new ResizeObserver(() => selectionStore.refresh());
    ro.observe(selected);
    return () => ro.disconnect();
  }, [active, selected, selectionStore]);

  if (!active) return null;
  return <PickerOverlay store={selectionStore} />;
});
ElementPicker.displayName = 'ElementPicker';
