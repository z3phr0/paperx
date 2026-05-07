/**
 * JsonPromptExporter — turns the ChangeLog into a Claude-Code-ready
 * prompt payload (paperx-prompt-v1).
 *
 * Responsibilities:
 *   1. Aggregate flat ChangeRecord[] → PaperxPromptTarget[] keyed by selector.
 *   2. Stamp meta (page url, title, paperx version, UA, counts).
 *   3. Render a human-readable preamble + fenced JSON via buildPromptText.
 *   4. Copy to clipboard with a Shadow-DOM-friendly fallback.
 *
 * Decoupling notes:
 *   - We accept records via `PromptSourceRecord[]` (structural type) so
 *     the smoke harness can drive the exporter without instantiating the
 *     full DI container or mocking Inversify decorators.
 *   - When called via DI, the optional argument falls back to
 *     `changeLogService.list()` so production callers never have to
 *     thread the records list explicitly.
 *   - `paperxVersion` is read from the build-time injected
 *     `import.meta.env` if available; falls back to '0.1.0' (matches
 *     package.json#version at the time of S2-A authorship).
 */
import { inject, injectable } from 'inversify';

import { TYPES } from '@/shared/di/tokens';
import type { IChangeLogService } from '@/shared/services/ChangeLogService';
import {
  PROMPT_SCHEMA_VERSION,
  type PaperxPrompt,
  type PaperxPromptChange,
  type PaperxPromptTarget,
  type PromptSourceRecord,
} from '@/shared/types/prompt';

export interface IJsonPromptExporter {
  /** Build the structured prompt object. Pass records to override the
   *  ChangeLog (e.g. to export a filtered subset); omit to pull live. */
  buildPrompt(records?: readonly PromptSourceRecord[]): PaperxPrompt;
  /** Build the human-readable preamble + fenced JSON suitable for
   *  pasting into Claude Code or any LLM chat. */
  buildPromptText(records?: readonly PromptSourceRecord[]): string;
  /** Copy buildPromptText() to clipboard. Returns true on success.
   *  `fallbackHost` is appended to during the textarea+execCommand
   *  fallback path; pass the Shadow DOM portal layer when calling from
   *  inside the content script so the textarea is not visible to the
   *  host page. */
  copyToClipboard(
    records?: readonly PromptSourceRecord[],
    fallbackHost?: ParentNode,
  ): Promise<boolean>;
}

const INSTRUCTIONS = [
  '你正在协助 paperx 完成可视化设计 → 源码同步。下面 `targets` 是用户在浏览器中可视化修改的 DOM 元素及其 CSS 变更。请：',
  '(1) 用 `dataPaperxUid` 优先在源码中定位 React 组件（搜 `data-paperx-uid="<uid>"` 字符串）；如缺，用 `selector` 与 `tagName` 启发式定位。',
  '(2) 对每个组件，把 `changes` 数组里的 CSS 变更同步到组件 className（优先 Tailwind）或 inline style/CSS 模块（按项目惯例）。',
  '(3) `before` 是元素原值（可能是 computed style），`after` 是 paperx 写入的 inline style 值——你应当让组件本身在源码层面实现 `after`。',
  '(4) `changes` 数组按 ts 升序，应用顺序与用户操作一致。同一 property 多次出现时，最后一次的 `after` 是最终态。',
].join('\n');

/** Read paperx package version from vite-injected env, with a stable
 *  fallback so node-side tests (no Vite) still produce valid output. */
function readPaperxVersion(): string {
  // import.meta.env is provided by Vite at build-time; in raw node it
  // is undefined. Wrapped in try/catch so a tooling environment that
  // doesn't permit `import.meta` doesn't blow up.
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> })
      .env;
    return env?.PAPERX_VERSION ?? env?.VITE_PAPERX_VERSION ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}

/** Last segment of a `a > b > c` selector; tag name only (drop classes). */
function deriveTagName(selector: string): string {
  if (!selector) return 'unknown';
  const tail = selector.split('>').pop()?.trim() ?? '';
  if (!tail) return 'unknown';
  const m = tail.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
  return m ? m[0].toLowerCase() : 'unknown';
}

function aggregateTargets(
  records: readonly PromptSourceRecord[],
): PaperxPromptTarget[] {
  const map = new Map<string, PaperxPromptTarget>();
  for (const r of records) {
    let target = map.get(r.selector);
    if (!target) {
      target = {
        selector: r.selector,
        tagName: deriveTagName(r.selector),
        changes: [],
      };
      if (r.dataPaperxUid !== undefined && r.dataPaperxUid !== null) {
        target.dataPaperxUid = r.dataPaperxUid;
      }
      map.set(r.selector, target);
    } else if (
      target.dataPaperxUid === undefined &&
      r.dataPaperxUid !== undefined &&
      r.dataPaperxUid !== null
    ) {
      // Earlier records may have lacked uid; later one filled it in.
      target.dataPaperxUid = r.dataPaperxUid;
    }
    const change: PaperxPromptChange = {
      id: r.id,
      ts: r.ts,
      property: r.property,
      before: r.before,
      after: r.after,
      mode: r.mode,
    };
    target.changes.push(change);
  }
  // Per-target: oldest → newest (application order).
  for (const t of map.values()) {
    t.changes.sort((a, b) => a.ts - b.ts);
  }
  // Targets order is insertion order (== first-seen). Stable enough for
  // human review; consumers should not depend on it.
  return Array.from(map.values());
}

@injectable()
export class JsonPromptExporter implements IJsonPromptExporter {
  constructor(
    @inject(TYPES.ChangeLogService) private readonly log: IChangeLogService,
  ) {}

  buildPrompt(records?: readonly PromptSourceRecord[]): PaperxPrompt {
    const src: readonly PromptSourceRecord[] =
      records ?? (this.log.list() as readonly PromptSourceRecord[]);
    const targets = aggregateTargets(src);
    const meta = this.buildMeta(src, targets.length);
    return {
      schema: PROMPT_SCHEMA_VERSION,
      meta,
      targets,
      instructions: INSTRUCTIONS,
    };
  }

  buildPromptText(records?: readonly PromptSourceRecord[]): string {
    const prompt = this.buildPrompt(records);
    const preamble = [
      `# paperx prompt (${prompt.schema})`,
      `# generated ${prompt.meta.generatedAt} for ${prompt.meta.pageUrl || '(unknown page)'}`,
      `# ${prompt.meta.changeCount} change(s) across ${prompt.meta.selectionCount} target(s) — paste into Claude Code:`,
    ].join('\n');
    const json = JSON.stringify(prompt, null, 2);
    return `${preamble}\n\n\`\`\`json\n${json}\n\`\`\`\n`;
  }

  async copyToClipboard(
    records?: readonly PromptSourceRecord[],
    fallbackHost?: ParentNode,
  ): Promise<boolean> {
    const text = this.buildPromptText(records);

    // Primary path: navigator.clipboard. Available in MV3 content
    // scripts when called from a user-initiated event handler (e.g.
    // button click). Wrapped in try/catch because some sites strip
    // clipboard permissions or run in iframes without it.
    try {
      const nav = (globalThis as { navigator?: Navigator }).navigator;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn('[paperx/JsonPromptExporter] clipboard.writeText failed', err);
    }

    // Fallback: textarea + execCommand('copy'). Mounted into the Shadow
    // DOM portal layer when caller provides one, otherwise document.body.
    try {
      const doc = (globalThis as { document?: Document }).document;
      if (!doc) return false;
      const ta = doc.createElement('textarea');
      ta.value = text;
      // Off-screen but focusable. position:fixed so layout never shifts.
      ta.style.cssText =
        'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
      ta.setAttribute('readonly', 'true');
      const host = fallbackHost ?? doc.body;
      host.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = doc.execCommand('copy');
      ta.remove();
      return ok;
    } catch (err) {
      console.warn('[paperx/JsonPromptExporter] execCommand fallback failed', err);
      return false;
    }
  }

  private buildMeta(
    records: readonly PromptSourceRecord[],
    targetCount: number,
  ): PaperxPrompt['meta'] {
    const win = globalThis as { location?: Location; document?: Document };
    const generatedAt = new Date().toISOString();
    const pageUrl = win.location?.href ?? '';
    const pageTitle = win.document?.title ?? '';
    const userAgent = (globalThis as { navigator?: Navigator }).navigator
      ?.userAgent;
    const meta: PaperxPrompt['meta'] = {
      generatedAt,
      paperxVersion: readPaperxVersion(),
      pageUrl,
      pageTitle,
      selectionCount: targetCount,
      changeCount: records.length,
    };
    if (userAgent) meta.userAgent = userAgent;
    return meta;
  }
}
