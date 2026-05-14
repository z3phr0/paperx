/**
 * CodeBlock — Inspect sub-tab snippets that mirror the element's real
 * DOM attributes.
 *
 * - CSS view: shows the element's literal `class=""` and `style=""`
 *   attributes, split into per-declaration lines for readability.
 * - Tailwind view: a list of [class → resolved CSS] pairs. Each item's
 *   top row is the class name; the bottom row is the declarations the
 *   class produces in the host stylesheet (or inline style at the tail).
 *   The copy button concatenates every Tailwind class so the result is
 *   paste-ready for `className=""`.
 * - JSX view: untouched skeletal snippet from the prior cut.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { IconButton, Section, Segmented } from '@/shared/ui-v2';
import { readPx } from '../hooks/useComputedStyle';
import { lookupClassRule } from '@/shared/utils/lookupClassRule';

interface Props {
  target: HTMLElement;
}

type Lang = 'css' | 'tailwind' | 'jsx';

interface Line {
  __html: string;
}

interface TwItem {
  className: string;
  css: string | null;
  source: 'class' | 'inline';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cssLines(target: HTMLElement): Line[] {
  const className = target.getAttribute('class') ?? '';
  const styleAttr = target.getAttribute('style') ?? '';
  const lines: Line[] = [];

  if (className) {
    lines.push({
      __html: `<span class="dv-tok-prop">class</span>=<span class="dv-tok-val">"${escapeHtml(className)}"</span>`,
    });
  }

  if (styleAttr) {
    for (const decl of styleAttr.split(';')) {
      const trimmed = decl.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(':');
      if (colon < 0) continue;
      const prop = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      lines.push({
        __html: `<span class="dv-tok-prop">${escapeHtml(prop)}</span>: <span class="dv-tok-val">${escapeHtml(value)}</span>;`,
      });
    }
  }

  if (lines.length === 0) {
    lines.push({
      __html: `<span class="dv-tok-muted">(no class or inline style on this element)</span>`,
    });
  }

  return lines;
}

function twItems(target: HTMLElement): TwItem[] {
  const items: TwItem[] = [];
  const classes = (target.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  for (const cls of classes) {
    items.push({ className: cls, css: lookupClassRule(cls), source: 'class' });
  }
  const styleAttr = (target.getAttribute('style') ?? '').trim();
  if (styleAttr) {
    items.push({ className: '(inline)', css: styleAttr, source: 'inline' });
  }
  return items;
}

function jsxLines(target: HTMLElement): Line[] {
  const tag = target.tagName.toLowerCase();
  const w = readPx(target, 'width') || '0';
  const padX = readPx(target, 'padding-left') || '0';
  return [
    {
      __html: `<span class="dv-tok-keyword">const</span> <span class="dv-tok-fn">Element</span> = () =&gt; (`,
    },
    {
      __html: `&nbsp;&nbsp;<span class="dv-tok-val">&lt;${tag}</span> <span class="dv-tok-prop">style</span>={{`,
    },
    {
      __html: `&nbsp;&nbsp;&nbsp;&nbsp;<span class="dv-tok-prop">width</span>: <span class="dv-tok-num">${w}</span>,`,
    },
    {
      __html: `&nbsp;&nbsp;&nbsp;&nbsp;<span class="dv-tok-prop">paddingInline</span>: <span class="dv-tok-num">${padX}</span>,`,
    },
    { __html: `&nbsp;&nbsp;}} <span class="dv-tok-val">/&gt;</span>` },
    { __html: `)` },
  ];
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard refused (no permission / non-secure) — silent best-effort
    // is fine here; nothing else depends on success.
  }
}

function linesToText(lines: Line[]): string {
  return lines
    .map((l) =>
      l.__html
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&'),
    )
    .join('\n');
}

const LANG_ITEMS: ReadonlyArray<{ value: Lang; label: string }> = [
  { value: 'css', label: 'CSS' },
  { value: 'tailwind', label: 'TW' },
  { value: 'jsx', label: 'JSX' },
];

export const CodeBlock = observer(({ target }: Props) => {
  const [lang, setLang] = React.useState<Lang>('css');

  // Re-read on every render — host stylesheet rules + inline style can
  // change between renders (other panels write inline styles). Memoizing
  // here would make the view drift behind ChangeLog.
  const cssView = lang === 'css' ? cssLines(target) : null;
  const tw = lang === 'tailwind' ? twItems(target) : null;
  const jsxView = lang === 'jsx' ? jsxLines(target) : null;

  const handleCopy = (): void => {
    if (lang === 'tailwind' && tw) {
      const joined = tw
        .filter((i) => i.source === 'class')
        .map((i) => i.className)
        .join(' ');
      void copyText(joined);
      return;
    }
    const lines = cssView ?? jsxView ?? [];
    void copyText(linesToText(lines));
  };

  return (
    <Section
      title=""
      data-testid="paperx-v2-code-block"
      actions={
        <>
          <Segmented
            value={lang}
            onChange={setLang}
            items={LANG_ITEMS}
            data-testid="paperx-v2-code-lang"
          />
          <IconButton
            icon="copy"
            title="Copy"
            onClick={handleCopy}
            data-testid="paperx-v2-code-copy"
          />
        </>
      }
    >
      {tw ? (
        <div className="dv-code-block" data-testid="paperx-v2-code-tw-list">
          {tw.map((it, i) => (
            <div
              key={`${it.className}-${i}`}
              className="dv-code-tw-item"
              data-source={it.source}
            >
              <div className="dv-code-tw-name">{it.className}</div>
              <div className="dv-code-tw-css">{it.css ?? '— no rule —'}</div>
            </div>
          ))}
          {tw.length === 0 && (
            <div className="dv-code-line">
              <span className="dv-tok-muted">(no class or inline style on this element)</span>
            </div>
          )}
        </div>
      ) : (
        <div className="dv-code-block">
          {(cssView ?? jsxView ?? []).map((l, i) => (
            <div key={i} className="dv-code-line">
              <span className="dv-code-num">{i + 1}</span>
              <span dangerouslySetInnerHTML={l} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
});
CodeBlock.displayName = 'CodeBlock';
