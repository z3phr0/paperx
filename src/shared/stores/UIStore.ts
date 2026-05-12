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
  // Nullable: `null` means no active panel mode — the toolbar pill is
  // visible but neither the picker outline nor any side panel render.
  // Clicking an active toolbar mode button toggles back to `null` so
  // users can collapse the panels without leaving paperx entirely.
  mode: ToolMode | null = null;
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
      toggleMode: action,
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

  setMode(next: ToolMode | null): void {
    this.mode = next;
  }

  /** Click-active-deselects: same value -> null, otherwise switch. */
  toggleMode(next: ToolMode): void {
    this.mode = this.mode === next ? null : next;
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
