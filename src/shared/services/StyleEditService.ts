/**
 * StyleEditService — single writer of inline-style edits.
 *
 * Every style mutation initiated by paperx UI must go through `apply()`.
 * That guarantees:
 *   1. ChangeLog is always kept in sync (single source of truth for export
 *      / undo / reset)
 *   2. We capture `before` exactly once (from inline style first, falling
 *      back to computed style) so undo restores the *user-visible* prior
 *      value rather than a parsed shorthand
 *   3. Property names are kebab-case end-to-end (CSSStyleDeclaration's
 *      setProperty/getPropertyValue accept kebab-case as the canonical
 *      form; camelCase keys would silently fail for hyphenated props)
 *
 * `undo(changeId)` walks back a single record; `reset(target?)` walks the
 * full log in reverse and reverts every record matching the optional
 * target. Both leave the ChangeLog clean (no dangling records).
 */
import { inject, injectable } from 'inversify';

import { TYPES } from '@/shared/di/tokens';
import {
  type ChangeRecord,
  type IChangeLogService,
} from '@/shared/services/ChangeLogService';
import { buildSelector } from '@/shared/types/changes';
import type { ToolMode } from '@/shared/types/modes';

export interface IStyleEditService {
  /**
   * Set `prop` to `value` on `target`'s inline style and append a
   * ChangeRecord. `prop` MUST be kebab-case (e.g. "font-size"). Returns
   * the recorded id (or null when the operation was a no-op).
   */
  apply(
    target: HTMLElement,
    prop: string,
    value: string,
    mode?: ToolMode,
  ): string | null;
  /** Revert a single change by id and remove it from the log. */
  undo(changeId: string): void;
  /** Revert every change (or every change for `target`) in reverse order. */
  reset(target?: HTMLElement): void;
}

function readBefore(target: HTMLElement, prop: string): string {
  // Prefer the inline value so undo restores exactly what the user (or the
  // host page) originally had. Fall back to computed when there is no
  // inline declaration yet.
  const inline = target.style.getPropertyValue(prop);
  if (inline && inline.length > 0) return inline;
  try {
    return getComputedStyle(target).getPropertyValue(prop) ?? '';
  } catch {
    return '';
  }
}

function makeId(): string {
  // crypto.randomUUID is available in Chrome MV3 service workers and
  // content scripts (DOM context). Fall back to a timestamp-based id to
  // satisfy old jsdom envs used in smoke tests.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `chg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

@injectable()
export class StyleEditService implements IStyleEditService {
  constructor(
    @inject(TYPES.ChangeLogService) private readonly log: IChangeLogService,
  ) {}

  apply(
    target: HTMLElement,
    prop: string,
    value: string,
    mode: ToolMode = 'design',
  ): string | null {
    if (!target || !prop) return null;
    const before = readBefore(target, prop);
    if (before === value) return null; // no-op

    try {
      target.style.setProperty(prop, value);
    } catch (err) {
      console.warn('[paperx/StyleEditService] setProperty failed', err);
      return null;
    }

    const record: ChangeRecord = {
      id: makeId(),
      ts: Date.now(),
      selector: buildSelector(target),
      property: prop,
      before,
      after: value,
      mode,
    };
    this.log.append(record);
    // Keep a back-reference so undo can find the live element later.
    // We store on the record-keyed weak map below.
    targetMap.set(record.id, target);
    // Mirror to ChangeLogService so cross-cutting consumers (drawer
    // Locate button, JsonPromptExporter) can resolve element back
    // from id without taking a dependency on StyleEditService (which
    // would be a circular DI edge: log -> editor -> log).
    this.log.attachTarget(record.id, target);
    return record.id;
  }

  undo(changeId: string): void {
    const target = targetMap.get(changeId);
    if (!target) return;
    const rec = this.log.list().find((r) => r.id === changeId);
    if (!rec) return;
    this.writeBack(target, rec);
    targetMap.delete(changeId);
    this.log.remove(changeId);
  }

  reset(target?: HTMLElement): void {
    const all = [...this.log.list()];
    // Reverse-iterate so cascading edits (e.g. width then min-width on the
    // same element) restore in the order they were applied.
    for (let i = all.length - 1; i >= 0; i -= 1) {
      const rec = all[i]!;
      const t = targetMap.get(rec.id);
      if (!t) continue;
      if (target && t !== target) continue;
      this.writeBack(t, rec);
      targetMap.delete(rec.id);
      this.log.remove(rec.id);
    }
  }

  private writeBack(target: HTMLElement, rec: ChangeRecord): void {
    try {
      if (rec.before === '') {
        target.style.removeProperty(rec.property);
      } else {
        target.style.setProperty(rec.property, rec.before);
      }
    } catch (err) {
      console.warn('[paperx/StyleEditService] writeBack failed', err);
    }
  }
}

/**
 * id → live element map kept outside MobX so we don't deep-observe DOM
 * nodes. WeakMap on the record id is impossible (string keys), but
 * leaking IDs is bounded by ChangeLog size which is itself observable.
 */
const targetMap = new Map<string, HTMLElement>();
