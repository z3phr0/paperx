/**
 * ChangeLogService — canonical change-log + DOM back-reference index.
 *
 * Phase 1 shipped the observable record list. Phase 2 (S2-A) extends
 * it with a DOM back-reference so consumers (JsonPromptExporter, the
 * drawer's Locate button) can find the live HTMLElement that produced
 * a record without a circular dependency on StyleEditService.
 *
 * Why a WeakRef map (and not a `targetRef` field on ChangeRecord):
 *   1. ChangeRecord is the wire format for export; embedding a live
 *      DOM node would (a) bloat MobX deep-observation cost and
 *      (b) leak host-page elements across detach/re-attach cycles.
 *   2. WeakRef lets the host page GC its own elements; we treat
 *      `getTargetById` as "best effort, may return null" by contract,
 *      which the UI honors (Locate disables, Undo no-ops).
 *   3. The map is keyed by string id, so a plain WeakMap is impossible
 *      (WeakMap keys must be objects). WeakRef-of-element is the
 *      semantic equivalent: no strong reference to the DOM node.
 *
 * Dependency direction stays clean: StyleEditService -> ChangeLogService.
 * ChangeLogService never imports StyleEditService.
 */
import { injectable } from 'inversify';
import { makeObservable, observable, action } from 'mobx';

export interface ChangeRecord {
  /** Stable id, e.g. crypto.randomUUID(). */
  id: string;
  /** Timestamp when the edit was committed (ms since epoch). */
  ts: number;
  /** CSS-selector-ish path to the edited node (Phase 1: just css path). */
  selector: string;
  /** Property name, e.g. "font-size" or "tw:px-4". */
  property: string;
  /** Previous value (so we can `reset`). */
  before: string;
  /** New value. */
  after: string;
  /** Origin tool mode that produced this change. */
  mode: 'design' | 'ruler' | 'comment' | 'layout';
}

export interface ChangeLogFilter {
  selector?: string;
  property?: string;
  mode?: ChangeRecord['mode'];
}

export interface IChangeLogService {
  readonly records: readonly ChangeRecord[];
  append(record: ChangeRecord): void;
  list(filter?: ChangeLogFilter): readonly ChangeRecord[];
  reset(): void;
  remove(id: string): void;
  /**
   * Associate a record id with the live DOM element it edited. Stored
   * as a weak reference so the host page can GC the node freely.
   * Idempotent: subsequent calls with the same id replace the prior ref.
   */
  attachTarget(id: string, el: HTMLElement): void;
  /**
   * Resolve a record id back to its live element, or null if the
   * element has been GCed / detached / never attached.
   */
  getTargetById(id: string): HTMLElement | null;
}

@injectable()
export class ChangeLogService implements IChangeLogService {
  private _records: ChangeRecord[] = [];

  constructor() {
    makeObservable<this, '_records'>(this, {
      _records: observable,
      append: action,
      reset: action,
      remove: action,
    });
  }

  get records(): readonly ChangeRecord[] {
    return this._records;
  }

  append(record: ChangeRecord): void {
    this._records.push(record);
  }

  list(filter?: ChangeLogFilter): readonly ChangeRecord[] {
    if (!filter) return this._records;
    return this._records.filter((r) => {
      if (filter.selector && r.selector !== filter.selector) return false;
      if (filter.property && r.property !== filter.property) return false;
      if (filter.mode && r.mode !== filter.mode) return false;
      return true;
    });
  }

  reset(): void {
    this._records = [];
    targetRefs.clear();
  }

  remove(id: string): void {
    this._records = this._records.filter((r) => r.id !== id);
    targetRefs.delete(id);
  }

  attachTarget(id: string, el: HTMLElement): void {
    if (!id || !el) return;
    // Prefer WeakRef (Chrome 84+; MV3 baseline is Chrome 88+) so the
    // host page can GC the element. Fall back to a strong reference
    // for environments without WeakRef (older smoke harnesses, jsdom);
    // bounded by the ChangeLog size which is itself observable.
    const W = (globalThis as { WeakRef?: typeof WeakRef }).WeakRef;
    if (typeof W === 'function') {
      targetRefs.set(id, new W(el));
    } else {
      targetRefs.set(id, el);
    }
  }

  getTargetById(id: string): HTMLElement | null {
    const ref = targetRefs.get(id);
    if (!ref) return null;
    let el: HTMLElement | null;
    // `Element` may be undefined in non-DOM runtimes (smoke harness on
    // bun/node). Detect a WeakRef by duck-typing instead.
    const isWeakRef =
      typeof (ref as WeakRef<HTMLElement>).deref === 'function';
    if (isWeakRef) {
      el = (ref as WeakRef<HTMLElement>).deref() ?? null;
    } else {
      el = ref as HTMLElement;
    }
    if (!el) {
      // GCed — drop the dangling entry.
      targetRefs.delete(id);
      return null;
    }
    // Stale guard: the element might have been removed from the
    // document (SPA re-render). Treat as null so the UI shows
    // "Locate" disabled. We don't delete the ref — the element might
    // be re-attached later (rare, but harmless to keep around).
    if (typeof el.isConnected === 'boolean' && !el.isConnected) {
      return null;
    }
    return el;
  }
}

/**
 * id -> live element map kept outside MobX so we don't deep-observe
 * DOM nodes. Values are `WeakRef<HTMLElement>` when the runtime has
 * WeakRef, else a plain HTMLElement (smoke / jsdom fallback).
 */
const targetRefs = new Map<string, WeakRef<HTMLElement> | HTMLElement>();
