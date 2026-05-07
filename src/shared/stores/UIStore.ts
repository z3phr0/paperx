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

  constructor() {
    makeObservable(this, {
      visible: observable,
      mode: observable,
      toggle: action,
      show: action,
      hide: action,
      setMode: action,
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
}
