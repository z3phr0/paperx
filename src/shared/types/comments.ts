/**
 * paperx-comments-v1 — wire format for comment review notes.
 *
 * Independent from paperx-prompt-v1: comments are reviewer state, not
 * style edits, and may be imported / exported separately so a designer
 * can hand off a review JSON without bundling style mutations.
 */

export type CommentPriority = 'P0' | 'P1' | 'P2';

export const COMMENT_PRIORITIES: readonly CommentPriority[] = ['P0', 'P1', 'P2'] as const;
export const DEFAULT_PRIORITY: CommentPriority = 'P2';

/** Cycle order: P0 → P1 → P2 → P0. */
export function nextPriority(p: CommentPriority): CommentPriority {
  if (p === 'P0') return 'P1';
  if (p === 'P1') return 'P2';
  return 'P0';
}

export interface CommentBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PaperxComment {
  id: string;
  /** Stable key: dataUid ?? selector. */
  targetKey: string;
  /** Human-readable label captured at create time. */
  targetLabel: string;
  /** CSS-selector path captured at create time (for re-resolve on import). */
  selector: string;
  /** data-uid value if present at create time. */
  dataUid: string | null;
  /** lower-case tag name, e.g. 'button'. */
  tagName: string;
  /** Element bounding box at create time (viewport coords). */
  bbox: CommentBbox;
  /** Sampled background color (hex) or null when not resolvable. */
  thumbnailColor: string | null;
  /**
   * PNG data URL of the element captured by snapdom at create time.
   * Set asynchronously after add(); null while the capture is in
   * flight or if the capture failed. Optional on import for
   * forward / backward compatibility.
   */
  thumbnailDataUrl?: string | null;
  text: string;
  priority: CommentPriority;
  /** ms-since-epoch timestamp. */
  ts: number;
}

export interface PaperxCommentsV1 {
  schema: 'paperx-comments-v1';
  version: 1;
  generatedAt: string;
  source: 'paperx-extension';
  paperxVersion: string;
  pageUrl: string;
  pageTitle: string;
  comments: PaperxComment[];
}

export const COMMENTS_SCHEMA = 'paperx-comments-v1' as const;

/**
 * Validate a parsed unknown blob is a paperx-comments-v1 payload.
 * Returns the typed value or throws with a precise reason.
 */
export function parseCommentsV1(raw: unknown): PaperxCommentsV1 {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('expected JSON object');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== COMMENTS_SCHEMA) {
    throw new Error(`schema mismatch: expected ${COMMENTS_SCHEMA}, got ${String(obj.schema)}`);
  }
  if (obj.version !== 1) {
    throw new Error(`unsupported version: ${String(obj.version)}`);
  }
  if (!Array.isArray(obj.comments)) {
    throw new Error('comments must be an array');
  }
  // Light shape check on each entry — we don't deep-validate every
  // field; a partially-broken entry is better than rejecting the whole
  // import. The store's importMany is responsible for skipping
  // malformed entries.
  for (const c of obj.comments) {
    if (c == null || typeof c !== 'object') {
      throw new Error('every comment must be an object');
    }
    const e = c as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.text !== 'string') {
      throw new Error('comment missing required fields (id, text)');
    }
  }
  return obj as unknown as PaperxCommentsV1;
}
