/**
 * Phase 2 finer-grained change record types.
 *
 * Phase 1 already pinned `ChangeRecord` (see ChangeLogService.ts) with the
 * fields {id, ts, selector, property, before, after, mode}. We keep that
 * shape as the single source of truth and add only an optional bridge to
 * the `data-paperx-uid` set by the babel plugin (Phase 2 — R2). Adding
 * fields as optional is backward compatible with Phase 1 callers.
 */

/** Resolved target metadata captured at edit time. */
export interface ChangeTarget {
  /** A best-effort css path for human-friendly display. */
  selector: string;
  /** Babel plugin uid (Phase 2 R2). Null until the plugin runs in user code. */
  dataPaperxUid: string | null;
  /** Tag name (lowercase) — useful for filtering in change-log UI. */
  tagName: string;
}

/**
 * Build a coarse css-selector path for an element. Phase 1's ChangeLog
 * stores `selector: string`; this helper standardizes how we derive it
 * from a live HTMLElement.
 */
export function buildSelector(el: HTMLElement): string {
  if (!el || el.nodeType !== 1) return '';
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let cur: HTMLElement | null = el;
  let depth = 0;
  while (cur && cur.nodeType === 1 && depth < 5) {
    let part = cur.tagName.toLowerCase();
    if (cur.classList && cur.classList.length > 0) {
      const cls = Array.from(cur.classList).slice(0, 2).join('.');
      if (cls) part += `.${cls}`;
    }
    parts.unshift(part);
    cur = cur.parentElement;
    depth += 1;
  }
  return parts.join(' > ');
}

/** Return the babel-plugin-injected uid, or null. */
export function readPaperxUid(el: HTMLElement | null): string | null {
  if (!el) return null;
  return el.getAttribute('data-paperx-uid');
}
