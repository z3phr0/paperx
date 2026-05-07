/**
 * JsonPromptExporter — turn the canonical ChangeLog into a paperx
 * Prompt v1 JSON document and copy it to the clipboard.
 *
 * Aggregation algorithm (mirrors src/shared/types/prompt.ts contract):
 *   1. Iterate ChangeLog in append order (== chronological, since
 *      StyleEditService is the single writer).
 *   2. Group records by `(readDataUid(target) ?? selector)`. uid
 *      wins when present; selector is the stable fallback.
 *   3. Within a group, collapse multi-edits of the same property
 *      into one change: keep the FIRST recorded `before` (user's
 *      original value) and the LAST recorded `after` (current
 *      value). Drop entries that net out to a noop
 *      (`first.before === last.after`).
 *   4. Emit `summary` block + `meta` block. `meta.pageUrl` falls
 *      back to empty string in non-DOM smoke environments.
 *
 * Clipboard strategy: prefer `navigator.clipboard.writeText`
 * (supported in MV3 content scripts inside a user gesture — and our
 * callers are button onClick handlers, which qualify). Fallback to
 * a synthetic `<textarea>` + `document.execCommand('copy')` for old
 * hosts. Both paths are best-effort; failure surfaces as a
 * structured `ExportResult`, never an exception.
 */
import { inject, injectable } from 'inversify';

import { TYPES } from '@/shared/di/tokens';
import { type ChangeRecord, type IChangeLogService } from '@/shared/services/ChangeLogService';
import { buildSelector, readDataUid } from '@/shared/types/changes';
import type { ToolMode } from '@/shared/types/modes';
import {
  PROMPT_SCHEMA_VERSION,
  type PaperxPromptChange,
  type PaperxPromptTarget,
  type PaperxPromptV1,
} from '@/shared/types/prompt';

const PAPERX_VERSION = '0.1.0';

const DEFAULT_INSTRUCTIONS = [
  '你正在协助 paperx 完成可视化设计 → 源码同步。下面 `targets` 是用户在浏览器中可视化修改的 DOM 元素及其 CSS 变更。请：',
  '(1) 用 `dataUid` 优先在源码中定位 React 组件（搜 `data-uid="<uid>"` 字符串）；如缺，用 `selector` 与 `tagName` 启发式定位。',
  '(2) 对每个组件，把 `changes` 数组里的 CSS 变更同步到组件 className（优先 Tailwind）或 inline style/CSS 模块（按项目惯例）。',
  '(3) `before` 是元素原值（可能是 computed style），`after` 是 paperx 写入的 inline style 值——你应当让组件本身在源码层面实现 `after`。',
  '(4) v1 中 `appliedAs === "inline-style"`；v2 会加 `"tailwind"`。',
].join('\n');

export interface ExportOk {
  ok: true;
  promptSize: number;
}

export interface ExportErr {
  ok: false;
  error: string;
}

export type ExportResult = ExportOk | ExportErr;

export interface IJsonPromptExporter {
  /** Build the v1 prompt object from the current ChangeLog state. */
  build(): PaperxPromptV1;
  /** Build + serialize + copy as pure JSON. User-gesture-safe; never throws. */
  exportToClipboard(): Promise<ExportResult>;
}

interface PropFold {
  first: ChangeRecord;
  last: ChangeRecord;
}

interface Group {
  key: string;
  /** First non-null element resolved across the group. */
  element: HTMLElement | null;
  /** Snapshot used as a selector fallback when `element` is GCed. */
  sampleSelector: string;
  /** Per-property fold (first-seen / last-seen records). */
  perProp: Map<string, PropFold>;
  /** Modes observed in this group. */
  modes: Set<ToolMode>;
}

@injectable()
export class JsonPromptExporter implements IJsonPromptExporter {
  constructor(@inject(TYPES.ChangeLogService) private readonly log: IChangeLogService) {}

  build(): PaperxPromptV1 {
    return this.buildFrom(this.log.list(), (id) => this.log.getTargetById(id));
  }

  async exportToClipboard(): Promise<ExportResult> {
    let json: string;
    try {
      json = JSON.stringify(this.build(), null, 2);
    } catch (err) {
      return { ok: false, error: stringifyError(err, 'serialize failed') };
    }

    // Path 1: navigator.clipboard. MV3 content scripts in a user
    // gesture have the permission by default for secure contexts.
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(json);
        return { ok: true, promptSize: json.length };
      } catch (err) {
        console.warn('[paperx/JsonPromptExporter] clipboard.writeText failed, falling back', err);
      }
    }

    // Path 2: synthetic textarea + execCommand('copy'). Deprecated
    // but works on every Chromium MV3 host we care about.
    const doc = (globalThis as { document?: Document }).document;
    if (doc) {
      try {
        const ta = doc.createElement('textarea');
        ta.value = json;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
        ta.setAttribute('readonly', '');
        doc.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, json.length);
        const ok = doc.execCommand('copy');
        doc.body.removeChild(ta);
        if (ok) return { ok: true, promptSize: json.length };
      } catch (err) {
        console.warn('[paperx/JsonPromptExporter] execCommand copy failed', err);
      }
    }

    return { ok: false, error: 'clipboard unavailable' };
  }

  /**
   * Shared aggregation core. Take chronological records + an
   * id-to-element resolver and produce a fully populated
   * PaperxPromptV1.
   */
  private buildFrom(
    records: readonly ChangeRecord[],
    resolveTarget: (id: string) => HTMLElement | null,
  ): PaperxPromptV1 {
    const groups = new Map<string, Group>();

    for (const r of records) {
      const el = resolveTarget(r.id);
      const uid = el ? readDataUid(el) : null;
      const key = uid ?? r.selector;

      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          element: el,
          sampleSelector: r.selector,
          perProp: new Map(),
          modes: new Set<ToolMode>(),
        };
        groups.set(key, g);
      } else if (g.element == null && el) {
        // Adopt the first non-null element we see — earlier records
        // may have been GCed but a later one is still live.
        g.element = el;
      }

      g.modes.add(r.mode as ToolMode);
      const fold = g.perProp.get(r.property);
      if (!fold) {
        g.perProp.set(r.property, { first: r, last: r });
      } else {
        // first stays put (preserves the user's original value);
        // last advances to the most recent edit.
        fold.last = r;
      }
    }

    const targets: PaperxPromptTarget[] = [];
    let totalChanges = 0;
    const allModes = new Set<ToolMode>();

    for (const g of groups.values()) {
      const el = g.element;
      const tagName = el ? el.tagName.toLowerCase() : extractTag(g.sampleSelector);
      const elUid = el ? readDataUid(el) : null;
      // Group key may itself be a uid; if the live element is gone
      // but the key looks like a uid (no css path delimiters), keep
      // it. This preserves uid-based aggregation across detach.
      const inferredUid =
        elUid ?? (g.key !== g.sampleSelector && !g.key.includes('>') ? g.key : null);
      // Regenerate selector from the live element when possible;
      // fall back to the sample when the element is gone.
      const selector = el ? buildSelector(el) : g.sampleSelector;

      const changes: PaperxPromptChange[] = [];
      for (const fold of g.perProp.values()) {
        const before = fold.first.before;
        const after = fold.last.after;
        if (before === after) continue; // round-trip noop, omit
        changes.push({
          property: fold.last.property,
          before,
          after,
          appliedAs: 'inline-style',
          mode: fold.last.mode as ToolMode,
        });
      }
      if (changes.length === 0) continue; // entire group netted out

      // Stable order inside a target: alphabetic by property —
      // easier to diff repeated exports.
      changes.sort((a, b) => a.property.localeCompare(b.property));

      totalChanges += changes.length;
      for (const m of g.modes) allModes.add(m);

      targets.push({
        dataUid: inferredUid,
        selector,
        tagName,
        changes,
      });
    }

    // Stable order across exports: by selector, then by uid for
    // determinism in tests / diffs.
    targets.sort((a, b) => {
      const s = a.selector.localeCompare(b.selector);
      if (s !== 0) return s;
      return (a.dataUid ?? '').localeCompare(b.dataUid ?? '');
    });

    const generatedAt = new Date().toISOString();
    const pageUrl = safeRead(() => location.href, '');
    const pageTitle = safeRead(() => document.title, '');
    const userAgent = safeRead<string | undefined>(() => navigator.userAgent, undefined);

    return {
      schema: PROMPT_SCHEMA_VERSION,
      version: 1,
      generatedAt,
      source: 'paperx-extension',
      meta: {
        generatedAt,
        paperxVersion: PAPERX_VERSION,
        pageUrl,
        pageTitle,
        ...(userAgent ? { userAgent } : {}),
        selectionCount: targets.length,
        changeCount: totalChanges,
      },
      summary: {
        totalChanges,
        uniqueTargets: targets.length,
        modes: [...allModes].sort() as ToolMode[],
      },
      targets,
      instructions: DEFAULT_INSTRUCTIONS,
    };
  }
}

/**
 * Pull the trailing tag from a selector path like `div > span.foo.bar`.
 * Falls back to `'unknown'` if the input doesn't look like our
 * buildSelector output, so downstream tagName fields are never empty.
 */
function extractTag(selector: string): string {
  if (!selector) return 'unknown';
  const last = selector.split('>').pop()?.trim() ?? '';
  if (!last) return 'unknown';
  const m = last.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
  return m ? m[0].toLowerCase() : 'unknown';
}

function safeRead<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function stringifyError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err;
  return fallback;
}
