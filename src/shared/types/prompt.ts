/**
 * paperx JSON Prompt v1 — wire format consumed by Claude Code (or any
 * downstream LLM) to translate visual edits made in the browser back
 * into source-level component changes.
 *
 * Versioning policy:
 *   - `schema` is a literal string ("paperx-prompt-v1"). Bump to v2
 *     when the shape changes incompatibly. Adding optional fields is
 *     non-breaking.
 *   - `version` is the numeric major mirror of `schema` so consumers
 *     can branch ergonomically (`if (p.version === 1) ...`).
 *   - `meta.paperxVersion` mirrors `package.json#version` so we can
 *     ship migrations server-side if a downstream consumer ever needs
 *     them.
 *
 * Aggregation contract (S2-A): records are grouped by
 * `dataUid ?? selector`. The user project's `data-uid` is preferred
 * when present; selector is the stable fallback. Inside a target, the same property collapses
 * to a single change: `before` is the FIRST recorded `before` (the
 * user's true original value), `after` is the LAST recorded `after`
 * (their current value). Round-trip noops are omitted.
 *
 * `appliedAs` is a v1-only literal `'inline-style'` because S2-A only
 * writes inline styles. v2 will add `'tailwind'` once the reverse
 * mapper lands.
 */
import type { ToolMode } from '@/shared/types/modes';

/** Bump when the PaperxPrompt shape changes incompatibly. */
export const PROMPT_SCHEMA_VERSION = 'paperx-prompt-v1' as const;
export type PromptSchemaVersion = typeof PROMPT_SCHEMA_VERSION;

/** v1 only writes inline styles. v2 adds 'tailwind'. */
export type AppliedAs = 'inline-style';

/** A single CSS edit, normalized for prompt consumption (post-dedup). */
export interface PaperxPromptChange {
  /** Optional id of the canonical ChangeRecord (kept for compat with
   *  legacy consumers; new readers should not depend on it). */
  id?: string;
  /** ms since epoch (only meaningful when `id` is set). */
  ts?: number;
  /** kebab-case CSS property, e.g. "font-size". */
  property: string;
  /** Original value (may be a computed style, see StyleEditService). */
  before: string;
  /** Final inline-style value paperx wrote. */
  after: string;
  /** How the change was applied. v1 only ever emits 'inline-style'. */
  appliedAs: AppliedAs;
  /** Origin tool mode that produced this change. */
  mode: ToolMode;
}

/** All changes collapsed under one DOM target (== one source component). */
export interface PaperxPromptTarget {
  /**
   * The user project's `data-uid` attribute (Phase 2 R2 — paperx is a
   * pure consumer, never injects). Null tells the AI consumer to fall
   * back to selector + tagName matching.
   */
  dataUid: string | null;
  /**
   * css-selector path emitted by buildSelector(). Stable across
   * reloads for elements with stable structure / classNames; best-
   * effort only.
   */
  selector: string;
  /** Lower-case tag name (e.g. "div", "span"). */
  tagName: string;
  /** Per-target collapsed changes (one entry per distinct property). */
  changes: PaperxPromptChange[];
}

/** Summary block — duplicates a few fields from `meta` for ergonomics. */
export interface PaperxPromptSummary {
  /** Sum of `target.changes.length` across all targets (post-dedup). */
  totalChanges: number;
  /** Number of distinct targets. */
  uniqueTargets: number;
  /** Distinct ToolModes observed across all changes. */
  modes: ToolMode[];
}

export interface PaperxPromptMeta {
  /** ISO-8601 timestamp generated at export time. */
  generatedAt: string;
  /** Mirrors package.json#version. */
  paperxVersion: string;
  /** location.href of the page being edited. */
  pageUrl: string;
  /** document.title at export time. */
  pageTitle: string;
  /** navigator.userAgent — optional so node-side smoke tests can omit. */
  userAgent?: string;
  /** Number of distinct targets (== distinct selectors / uids). */
  selectionCount: number;
  /** Total ChangeRecord count flattened (post-dedup). */
  changeCount: number;
}

/** Top-level v1 wire format. */
export interface PaperxPrompt {
  schema: PromptSchemaVersion;
  /** Numeric major version mirror of `schema`. */
  version: 1;
  /** ISO-8601 timestamp (mirrors meta.generatedAt). */
  generatedAt: string;
  /** Producer identifier. Always 'paperx-extension' for v1. */
  source: 'paperx-extension';
  meta: PaperxPromptMeta;
  summary: PaperxPromptSummary;
  targets: PaperxPromptTarget[];
  /** Human-readable operating instructions appended to the JSON so
   *  a downstream LLM (or human reviewer) knows what to do with the
   *  data. */
  instructions: string;
  /** Optional free-form notes (reserved for future authoring UI). */
  notes?: string;
}

/**
 * Public alias matching the S2-A spec name. Some call sites prefer
 * the version-suffixed identifier ("PaperxPromptV1") over the
 * unsuffixed one; both refer to the same shape.
 */
export type PaperxPromptV1 = PaperxPrompt;

