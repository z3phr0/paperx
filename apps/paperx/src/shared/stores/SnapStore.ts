/**
 * SnapStore — transient drag-time state for the snap-to-alignment
 * guidelines overlay (P3-C).
 *
 * Two observable refs: the viewport-space coordinate of an active
 * vertical guide (`guideX`) and an active horizontal guide
 * (`guideY`). Each is null when the proposed rect isn't currently
 * snapping on that axis.
 *
 * Writers: ResizeHandles (and any future drag-to-move). Readers:
 * SnapGuidelines overlay. Cleared at mouseup so guides disappear the
 * instant the drag commits.
 */
import { makeObservable, observable, action } from 'mobx';
import { injectable } from 'inversify';

@injectable()
export class SnapStore {
  guideX: number | null = null;
  guideY: number | null = null;

  constructor() {
    makeObservable(this, {
      guideX: observable.ref,
      guideY: observable.ref,
      setGuides: action,
      clear: action,
    });
  }

  setGuides(next: { x?: number | null; y?: number | null }): void {
    if (next.x !== undefined) this.guideX = next.x;
    if (next.y !== undefined) this.guideY = next.y;
  }

  clear(): void {
    this.guideX = null;
    this.guideY = null;
  }
}
