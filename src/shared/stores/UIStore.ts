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

const TOOLBAR_POS_STORAGE_KEY = 'paperx.toolbarPos';

export interface Point2 {
  x: number;
  y: number;
}

function loadToolbarPos(): Point2 | null {
  try {
    const raw = sessionStorage.getItem(TOOLBAR_POS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed != null &&
      typeof parsed === 'object' &&
      typeof (parsed as Point2).x === 'number' &&
      typeof (parsed as Point2).y === 'number' &&
      Number.isFinite((parsed as Point2).x) &&
      Number.isFinite((parsed as Point2).y)
    ) {
      return { x: (parsed as Point2).x, y: (parsed as Point2).y };
    }
  } catch {
    // sessionStorage may be denied (file://, restricted contexts); fall
    // through and ship the default position. Matches the resilience
    // pattern used by ColorPicker's recents persistence.
  }
  return null;
}

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
  /**
   * FloatingToolbar pinned position (viewport-absolute, top-left origin).
   * `null` = use the default Tailwind `top-6 right-6` corner. Set when
   * the user drags the toolbar via its grip handle. Persists per session
   * via sessionStorage so the position survives an in-tab reload but a
   * fresh tab gets the familiar top-right default.
   */
  toolbarPosition: Point2 | null = null;

  private _flashTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.toolbarPosition = loadToolbarPos();
    makeObservable(this, {
      visible: observable,
      mode: observable,
      flashCommentId: observable,
      toolbarPosition: observable,
      toggle: action,
      show: action,
      hide: action,
      setMode: action,
      toggleMode: action,
      flashAt: action,
      clearFlash: action,
      setToolbarPosition: action,
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

  /**
   * Update the FloatingToolbar's pinned position. Pass `null` to reset
   * to the default top-right corner. Persists via sessionStorage; storage
   * failures are swallowed so a restricted context never breaks the UI.
   */
  setToolbarPosition(next: Point2 | null): void {
    this.toolbarPosition = next == null ? null : { x: next.x, y: next.y };
    try {
      if (next == null) sessionStorage.removeItem(TOOLBAR_POS_STORAGE_KEY);
      else sessionStorage.setItem(TOOLBAR_POS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage denied — keep the in-memory state */
    }
  }
}
