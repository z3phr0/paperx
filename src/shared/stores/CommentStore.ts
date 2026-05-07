/**
 * CommentStore — in-memory store for comment-mode review notes.
 *
 * A comment is keyed by `(dataUid ?? selector)` — same canonical
 * grouping the JSON Prompt exporter uses, so comments survive small
 * DOM mutations as long as data-uid is stable.
 *
 * Persistence: none yet. Comments are tab-local and live for the
 * paperx session. Future Phase will route through chrome.storage.session
 * or include them in the exported prompt.
 */
import { makeObservable, observable, action } from 'mobx';
import { injectable } from 'inversify';

import { buildSelector, readDataUid } from '@/shared/types/changes';

export interface PaperxComment {
  id: string;
  /** Stable key: dataUid ?? selector. */
  targetKey: string;
  /** Human-readable label captured at create time. */
  targetLabel: string;
  text: string;
  ts: number;
}

function targetKeyOf(el: HTMLElement): string {
  return readDataUid(el) ?? buildSelector(el);
}

function targetLabelOf(el: HTMLElement): string {
  const uid = readDataUid(el);
  if (uid) return `[data-uid="${uid}"]`;
  return buildSelector(el);
}

let _seq = 0;
const newId = (): string => `cmt-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

@injectable()
export class CommentStore {
  comments: PaperxComment[] = [];

  constructor() {
    makeObservable(this, {
      comments: observable.shallow,
      add: action,
      remove: action,
      reset: action,
    });
  }

  add(target: HTMLElement, text: string): PaperxComment | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const c: PaperxComment = {
      id: newId(),
      targetKey: targetKeyOf(target),
      targetLabel: targetLabelOf(target),
      text: trimmed,
      ts: Date.now(),
    };
    this.comments = [...this.comments, c];
    return c;
  }

  remove(id: string): void {
    this.comments = this.comments.filter((c) => c.id !== id);
  }

  reset(): void {
    this.comments = [];
  }

  listForTarget(target: HTMLElement | null): PaperxComment[] {
    if (!target) return [];
    const key = targetKeyOf(target);
    return this.comments.filter((c) => c.targetKey === key);
  }
}
