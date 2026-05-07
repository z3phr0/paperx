/**
 * paperx JSON Prompt v1 — wire format consumed by Claude Code (or any
 * downstream LLM) to translate visual edits made in the browser back into
 * source-level component changes.
 *
 * Versioning policy:
 *   - `schema` is a literal string. Bump to `paperx-prompt-v2` when the
 *     shape changes incompatibly. Adding optional fields is non-breaking.
 *   - `meta.paperxVersion` mirrors `package.json#version` so we can ship
 *     migrations server-side if a downstream consumer ever needs them.
 *
 * Aggregation contract: changes are grouped by `selector` (NOT by
 * dataPaperxUid — the babel plugin (R2) lands later, so most Phase 2
 * records will lack a uid). Targets without a uid are still actionable;
 * the AI consumer is told to fall back to selector + tagName heuristics
 * via `instructions`.
 */
import type { ToolMode } from '@/shared/types/modes';

/** Bump when the PaperxPrompt shape changes incompatibly. */
export const PROMPT_SCHEMA_VERSION = 'paperx-prompt-v1' as const;
export type PromptSchemaVersion = typeof PROMPT_SCHEMA_VERSION;

/** A single CSS edit, normalized for prompt consumption. */
export interface PaperxPromptChange {
  id: string;
  /** ms since epoch — kept so the AI can reason about edit order. */
  ts: number;
  /** kebab-case CSS property, e.g. "font-size". */
  property: string;
  /** Original value (may be a computed style, see StyleEditService). */
  before: string;
  /** Final inline-style value paperx wrote. */
  after: string;
  /** Origin tool mode that produced this change. */
  mode: ToolMode;
}

/** All changes collapsed under one DOM target (== one source component). */
export interface PaperxPromptTarget {
  /** css-selector path emitted by buildSelector(). Stable across reloads
   *  for elements with stable structure / classNames, best-effort only. */
  selector: string;
  /** Optional uid injected by tools/babel-plugin-paperx-uid (Phase 2 R2).
   *  Phase 2 records typically lack this; the field stays optional so the
   *  schema does not force a breaking change once the plugin lands. */
  dataPaperxUid?: string;
  /** Lower-case tag name derived from the selector tail. */
  tagName: string;
  /** Per-target changes in *application order* (oldest first) so a
   *  consumer applying them sequentially gets the same end state as the
   *  user saw in the browser. */
  changes: PaperxPromptChange[];
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
  /** Number of distinct targets (== distinct selectors). */
  selectionCount: number;
  /** Total ChangeRecord count flattened. */
  changeCount: number;
}

export interface PaperxPrompt {
  schema: PromptSchemaVersion;
  meta: PaperxPromptMeta;
  targets: PaperxPromptTarget[];
  /** Human-readable operating instructions appended to the JSON so a
   *  downstream LLM (or human reviewer) knows what to do with the data. */
  instructions: string;
}

/**
 * Subset of a ChangeRecord that JsonPromptExporter actually consumes.
 * Kept structurally compatible with `ChangeRecord` from
 * src/shared/services/ChangeLogService.ts so we don't have to import the
 * concrete type (and risk a circular dep with the service container).
 *
 * `dataPaperxUid` is read opportunistically — the field is not part of
 * the canonical ChangeRecord today (Phase 1 schema froze without it),
 * but exporter accepts it via structural typing for the day R2 ships.
 */
export interface PromptSourceRecord {
  id: string;
  ts: number;
  selector: string;
  property: string;
  before: string;
  after: string;
  mode: ToolMode;
  dataPaperxUid?: string;
}
