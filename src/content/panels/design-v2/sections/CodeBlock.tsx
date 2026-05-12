/**
 * CodeBlock — Inspect sub-tab snippets in CSS / Tailwind / React (JSX)
 * dialects. Read-only mirror of `getComputedStyle(target)`.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { IconButton, Section, Segmented } from '@/shared/ui-v2';
import { readPx } from '../hooks/useComputedStyle';

interface Props {
  target: HTMLElement;
}

type Lang = 'css' | 'tailwind' | 'jsx';

function readBg(target: HTMLElement): string {
  const inline = target.style.backgroundColor;
  if (inline) return inline;
  try {
    return getComputedStyle(target).backgroundColor || 'transparent';
  } catch {
    return 'transparent';
  }
}

function readOpacity(target: HTMLElement): string {
  const inline = target.style.opacity;
  if (inline) return inline;
  try {
    return getComputedStyle(target).opacity || '1';
  } catch {
    return '1';
  }
}

interface Line {
  __html: string;
}

function cssLines(target: HTMLElement): Line[] {
  const w = readPx(target, 'width') || '?';
  const h = readPx(target, 'height') || '?';
  const padT = readPx(target, 'padding-top') || '0';
  const padR = readPx(target, 'padding-right') || '0';
  const padB = readPx(target, 'padding-bottom') || '0';
  const padL = readPx(target, 'padding-left') || '0';
  const radius = readPx(target, 'border-radius') || '0';
  const bg = readBg(target);
  const opacity = readOpacity(target);
  return [
    {
      __html: `<span class="dv-tok-prop">width</span>: <span class="dv-tok-num">${w}px</span>;`,
    },
    {
      __html: `<span class="dv-tok-prop">height</span>: <span class="dv-tok-num">${h}px</span>;`,
    },
    {
      __html: `<span class="dv-tok-prop">padding</span>: <span class="dv-tok-num">${padT}px ${padR}px ${padB}px ${padL}px</span>;`,
    },
    {
      __html: `<span class="dv-tok-prop">border-radius</span>: <span class="dv-tok-num">${radius}px</span>;`,
    },
    {
      __html: `<span class="dv-tok-prop">background</span>: <span class="dv-tok-val">${bg}</span>;`,
    },
    {
      __html: `<span class="dv-tok-prop">opacity</span>: <span class="dv-tok-num">${opacity}</span>;`,
    },
  ];
}

function tailwindLines(target: HTMLElement): Line[] {
  const w = readPx(target, 'width') || '0';
  const h = readPx(target, 'height') || '0';
  const padX = readPx(target, 'padding-left') || '0';
  const padY = readPx(target, 'padding-top') || '0';
  const radius = readPx(target, 'border-radius') || '0';
  const bg = readBg(target);
  return [
    {
      __html: `<span class="dv-tok-val">w-[${w}px] h-[${h}px]</span>`,
    },
    {
      __html: `<span class="dv-tok-val">px-[${padX}px] py-[${padY}px] rounded-[${radius}px]</span>`,
    },
    {
      __html: `<span class="dv-tok-val">bg-[${bg}]</span>`,
    },
  ];
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
        .replace(/&gt;/g, '>'),
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
  // Re-read on every render — computed style follows live mutations from
  // other panels. Memoization is more harmful than helpful here.
  const lines =
    lang === 'css' ? cssLines(target) : lang === 'tailwind' ? tailwindLines(target) : jsxLines(target);

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
            onClick={() => void copyText(linesToText(lines))}
            data-testid="paperx-v2-code-copy"
          />
        </>
      }
    >
      <div className="dv-code-block">
        {lines.map((l, i) => (
          <div key={i} className="dv-code-line">
            <span className="dv-code-num">{i + 1}</span>
            <span dangerouslySetInnerHTML={l} />
          </div>
        ))}
      </div>
    </Section>
  );
});
CodeBlock.displayName = 'CodeBlock';
