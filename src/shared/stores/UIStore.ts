/**
 * UIStore — owns toolbar visibility and active tool mode.
 *
 * MobX 6 idiomatic style: `makeObservable` in constructor (not legacy
 * decorators) so it works regardless of useDefineForClassFields. Inversify
 * @injectable still requires emitDecoratorMetadata, which tsconfig provides.
 */
import { makeObservable, observable, action, computed } from 'mobx';
import { injectable } from 'inversify';

import type { ToolMode } from '@/shared/types/modes';

@injectable()
export class UIStore {
  visible = false;
  mode: ToolMode = 'design';
  /**
   * Comment id whose target should pulse a Locate flash overlay.
   * Auto-clears via setTimeout so consumers don't have to debounce.
   */
  flashCommentId: string | null = null;

  private _flashTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeObservable(this, {
      visible: observable,
      mode: observable,
      flashCommentId: observable,
      toggle: action,
      show: action,
      hide: action,
      setMode: action,
      flashAt: action,
      clearFlash: action,
      isActive: computed,
    });
  }

  get isActive(): boolean {
    return this.visible;
  }

  toggle(): void {
    this.visible = !this.visible;
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  setMode(next: ToolMode): void {
    this.mode = next;
  }

  flashAt(commentId: string, durationMs = 1800): void {
    this.flashCommentId = commentId;
    if (this._flashTimer != null) clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this.clearFlash(), durationMs);
  }

  clearFlash(): void {
    this.flashCommentId = null;
    if (this._flashTimer != null) {
      clearTimeout(this._flashTimer);
      this._flashTimer = null;
    }
  }
}
