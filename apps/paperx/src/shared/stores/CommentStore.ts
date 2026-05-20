/**
 * CommentStore — in-memory store for comment-mode review notes.
 *
 * Each comment is keyed by `(dataUid ?? selector)` — same canonical
 * grouping the JSON Prompt exporter uses, so comments survive small
 * DOM mutations as long as data-uid is stable.
 *
 * Persistence: none yet at the chrome.storage layer; the store does
 * support import/export of `paperx-comments-v1` JSON so a reviewer
 * can ship notes manually. A WeakRef map mirrors ChangeLogService:
 * locate buttons resolve a comment id back to its live DOM node when
 * the page hasn't navigated away.
 */
import { makeObservable, observable, action } from 'mobx';
import { injectable } from 'inversify';
import { snapdom } from '@zumer/snapdom';

import { buildSelector, readDataUid } from '@/shared/types/changes';
import {
  COMMENTS_SCHEMA,
  COMMENT_PRI_MAP,
  DEFAULT_PRIORITY,
  type CommentBbox,
  type CommentPriority,
  type PaperxComment,
  type PaperxCommentsV1,
} from '@/shared/types/comments';

declare const __PAPERX_VERSION__: string;

function targetKeyOf(el: HTMLElement): string {
  return readDataUid(el) ?? buildSelector(el);
}

function targetLabelOf(el: HTMLElement): string {
  const uid = readDataUid(el);
  if (uid) return `[data-uid="${uid}"]`;
  return buildSelector(el);
}

function captureBbox(el: HTMLElement): CommentBbox {
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.left),
    y: Math.round(r.top),
    w: Math.round(r.width),
    h: Math.round(r.height),
  };
}

function rgbToHex(rgb: string): string | null {
  // "rgb(59, 130, 246)" / "rgba(59, 130, 246, 0.5)" → "#3b82f6"
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  const [, r, g, b] = m;
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(r!)}${hex(g!)}${hex(b!)}`;
}

/** Pick a snapdom target that gives useful screenshot context.
 *  Parent if it exists and isn't <html> / <body> (avoid full-page
 *  captures that blow up the data URL size); otherwise the element
 *  itself. v0.13.1: was always `el`, which produced thumbnails of
 *  isolated spans / small buttons with no surrounding context. */
function pickCaptureTarget(el: HTMLElement): HTMLElement {
  const p = el.parentElement;
  if (!p) return el;
  const tag = p.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html') return el;
  return p;
}

async function capturePngDataUrl(
  target: HTMLElement,
  priority: CommentPriority,
): Promise<string | null> {
  try {
    const captureTarget = pickCaptureTarget(target);
    // scale=2 keeps the thumbnail crisp at DPR=2 displays for parents
    // up to ~600px wide. Larger parents naturally shrink via
    // `object-fit: contain` on the consumer side (CommentPanelV2
    // Thumbnail). v0.13.0 shipped scale=0.5 which read as visibly
    // blurry once the row started rendering at panel width.
    const result = await snapdom(captureTarget, {
      fast: true,
      scale: 2,
      embedFonts: false,
    });
    const canvas = await result.toCanvas();

    // When we walked up a level, draw a priority-colored frame at the
    // child's position inside the parent capture so the reviewer can
    // tell which sub-region of the screenshot was actually commented
    // on. Visually paired with the on-DOM CommentAnnotations chrome.
    if (captureTarget !== target) {
      const parentRect = captureTarget.getBoundingClientRect();
      const childRect = target.getBoundingClientRect();
      const scaleX = canvas.width / parentRect.width;
      const scaleY = canvas.height / parentRect.height;
      if (
        Number.isFinite(scaleX) &&
        Number.isFinite(scaleY) &&
        scaleX > 0 &&
        scaleY > 0
      ) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const x = (childRect.left - parentRect.left) * scaleX;
          const y = (childRect.top - parentRect.top) * scaleY;
          const w = childRect.width * scaleX;
          const h = childRect.height * scaleY;
          const color = COMMENT_PRI_MAP[priority].dot;
          // 2 CSS px stroke @ snapdom scale — keeps the frame from
          // reading as hairline on big parents or chunky on small
          // ones. Min 2 device px so it never disappears.
          ctx.lineWidth = Math.max(2, 2 * Math.min(scaleX, scaleY));
          ctx.strokeStyle = color;
          ctx.strokeRect(x, y, w, h);
        }
      }
    }

    return canvas.toDataURL('image/png');
  } catch (err) {
    // Don't surface to UI — fallback (color swatch / placeholder)
    // handles the empty case gracefully.
    console.warn('[paperx] snapdom capture failed', err);
    return null;
  }
}

function sampleColor(el: HTMLElement): string | null {
  try {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return null;
    return rgbToHex(bg);
  } catch {
    return null;
  }
}

let _seq = 0;
const newId = (): string => `cmt-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

// WeakRef map mirrors ChangeLogService — id → element so locate() can
// walk back to the live DOM node without holding a strong reference.
const targetRefs = new Map<string, WeakRef<HTMLElement> | HTMLElement>();

function attachRef(id: string, el: HTMLElement): void {
  const W = (globalThis as { WeakRef?: typeof WeakRef }).WeakRef;
  targetRefs.set(id, W ? new W(el) : el);
}

function derefRef(id: string): HTMLElement | null {
  const ref = targetRefs.get(id);
  if (!ref) return null;
  if (typeof (ref as WeakRef<HTMLElement>).deref === 'function') {
    return (ref as WeakRef<HTMLElement>).deref() ?? null;
  }
  return ref as HTMLElement;
}

@injectable()
export class CommentStore {
  comments: PaperxComment[] = [];

  constructor() {
    makeObservable(this, {
      comments: observable.shallow,
      add: action,
      remove: action,
      reset: action,
      setPriority: action,
      setResolved: action,
      setThumbnail: action,
      importMany: action,
    });
  }

  add(target: HTMLElement, text: string, priority: CommentPriority = DEFAULT_PRIORITY): PaperxComment | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const c: PaperxComment = {
      id: newId(),
      targetKey: targetKeyOf(target),
      targetLabel: targetLabelOf(target),
      selector: buildSelector(target),
      dataUid: readDataUid(target),
      tagName: target.tagName.toLowerCase(),
      bbox: captureBbox(target),
      thumbnailColor: sampleColor(target),
      thumbnailDataUrl: null,
      text: trimmed,
      priority,
      ts: Date.now(),
    };
    this.comments = [...this.comments, c];
    attachRef(c.id, target);

    // Fire-and-forget snapdom capture. We do not block the user on
    // capture; if it fails, the row falls back to the sampled color
    // swatch + tag/size block. v0.13.1: priority threads through so
    // capturePngDataUrl can draw the priority frame on the parent
    // screenshot.
    void capturePngDataUrl(target, priority).then((dataUrl) => {
      if (dataUrl) this.setThumbnail(c.id, dataUrl);
    });

    return c;
  }

  remove(id: string): void {
    this.comments = this.comments.filter((c) => c.id !== id);
    targetRefs.delete(id);
  }

  reset(): void {
    this.comments = [];
    targetRefs.clear();
  }

  setPriority(id: string, p: CommentPriority): void {
    const idx = this.comments.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const next = [...this.comments];
    next[idx] = { ...next[idx]!, priority: p };
    this.comments = next;
  }

  setResolved(id: string, resolved: boolean): void {
    const idx = this.comments.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const next = [...this.comments];
    next[idx] = { ...next[idx]!, resolved };
    this.comments = next;
  }

  setThumbnail(id: string, dataUrl: string | null): void {
    const idx = this.comments.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const next = [...this.comments];
    next[idx] = { ...next[idx]!, thumbnailDataUrl: dataUrl };
    this.comments = next;
  }

  /** Append imported comments (does not clear existing). */
  importMany(records: PaperxComment[]): number {
    if (!Array.isArray(records) || records.length === 0) return 0;
    // Defensive: drop entries that don't carry the minimum we need.
    // Normalize the v0.13.0 `resolved` field so legacy v0.12.x exports
    // (which omit it) land as `resolved: false` rather than undefined —
    // keeps downstream consumers from needing `?? false` everywhere.
    const valid = records
      .filter((r) => r != null && typeof r.id === 'string' && typeof r.text === 'string')
      .map((r) => ({ ...r, resolved: r.resolved ?? false }));
    this.comments = [...this.comments, ...valid];
    return valid.length;
  }

  listForTarget(target: HTMLElement | null): PaperxComment[] {
    if (!target) return [];
    const key = targetKeyOf(target);
    return this.comments.filter((c) => c.targetKey === key);
  }

  /** Re-resolve a comment id to its live element (locate button). */
  getTargetById(id: string): HTMLElement | null {
    return derefRef(id);
  }

  /** Build a paperx-comments-v1 export payload for the current store state. */
  exportV1(): PaperxCommentsV1 {
    const now = new Date().toISOString();
    return {
      schema: COMMENTS_SCHEMA,
      version: 1,
      generatedAt: now,
      source: 'paperx-extension',
      paperxVersion: __PAPERX_VERSION__,
      pageUrl: typeof location !== 'undefined' ? location.href : '',
      pageTitle: typeof document !== 'undefined' ? document.title : '',
      comments: this.comments,
    };
  }
}

// Re-export the public type for callers that import it from the store
// module out of habit.
export type { PaperxComment };
