/**
 * ChangeLogService — Phase 1 placeholder for the change-log feature
 * (see README: "底部 change-log 列出所有变更，支持筛选/定位/reset").
 *
 * Phase 1 ships only the in-memory implementation + interface. Phase 2 will:
 *   - persist via chrome.storage.session per tab
 *   - emit MobX-observable list for the FloatingToolbar bottom panel
 *   - feed the JSON Prompt exporter
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
  }

  remove(id: string): void {
    this._records = this._records.filter((r) => r.id !== id);
  }
}
