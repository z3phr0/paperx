/**
 * SelectionStore — Phase 2 design-mode selection state.
 *
 * Holds two distinct DOM references:
 *   - `hovered`: live mouseover target for the picker outline (transient)
 *   - `selected`: the user-clicked target consumed by DesignPanel (sticky
 *     until ESC or mode switch)
 *
 * Design notes:
 *   - Both are `observable.ref` so MobX does NOT walk the DOM tree (would
 *     blow up with an HTMLElement)
 *   - `selectedRect` is *not* a computed: a DOMRect read off a live element
 *     is not reactive in MobX terms — we cache it in an observable.ref and
 *     `refresh()` re-reads via getBoundingClientRect, which is the only way
 *     observers (PickerOverlay) can react to scroll / resize.
 */
import { makeObservable, observable, action, computed } from 'mobx';
import { injectable } from 'inversify';

import { readPaperxUid } from '@/shared/types/changes';

@injectable()
export class SelectionStore {
  hovered: HTMLElement | null = null;
  selected: HTMLElement | null = null;
  hoveredRect: DOMRect | null = null;
  selectedRect: DOMRect | null = null;

  constructor() {
    makeObservable(this, {
      hovered: observable.ref,
      selected: observable.ref,
      hoveredRect: observable.ref,
      selectedRect: observable.ref,
      hover: action,
      select: action,
      clear: action,
      refresh: action,
      selectedTagName: computed,
      selectedDataPaperxUid: computed,
    });
  }

  get selectedTagName(): string | null {
    return this.selected ? this.selected.tagName.toLowerCase() : null;
  }

  get selectedDataPaperxUid(): string | null {
    return readPaperxUid(this.selected);
  }

  hover(el: HTMLElement | null): void {
    this.hovered = el;
    this.hoveredRect = el ? el.getBoundingClientRect() : null;
  }

  select(el: HTMLElement | null): void {
    this.selected = el;
    this.selectedRect = el ? el.getBoundingClientRect() : null;
  }

  /** Recompute cached rects (call from scroll / resize / ResizeObserver). */
  refresh(): void {
    if (this.selected) {
      this.selectedRect = this.selected.getBoundingClientRect();
    }
    if (this.hovered) {
      this.hoveredRect = this.hovered.getBoundingClientRect();
    }
  }

  clear(): void {
    this.hovered = null;
    this.selected = null;
    this.hoveredRect = null;
    this.selectedRect = null;
  }
}
