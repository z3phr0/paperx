/**
 * CodeBlock — Inspect sub-tab. Two views over the live element:
 *
 *   - CSS: every property the element is "styled by" (declared by inline
 *     style or any matching same-origin class rule), sorted, shown with
 *     its `getComputedStyle` value. Mirrors the DevTools "Computed" tab
 *     filtered down to the explicitly-set properties.
 *
 *   - Tailwind (TW): the element's `class` split into a list. Each class
 *     shows the subset of CSS properties for which IT is the cascade
 *     winner (a later class or inline that also declares the same prop
 *     pushes the earlier class's row to `— overridden —`). Inline style
 *     becomes a trailing `(inline)` group and always wins. Values always
 *     come from `getComputedStyle` so cascade is reflected truthfully.
 *
 * Copy button:
 *   - CSS: emits `prop: value;` lines joined with `\n`.
 *   - TW:  emits the original class names joined with spaces, ready to
 *     paste back into `className=""`. Inline pseudo-row is excluded.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { IconButton, Section, Segmented } from '@/shared/ui-v2';
import { lookupClassRuleProps } from '@/shared/utils/lookupClassRule';

interface Props {
  target: HTMLElement;
}

type Lang = 'css' | 'tailwind';

type Decl = [prop: string, value: string];

interface TwItem {
  className: string;
  decls: Decl[];
  source: 'class' | 'inline';
}

function inlineProps(target: HTMLElement): string[] {
  const out: string[] = [];
  for (let i = 0; i < target.style.length; i++) {
    const p = target.style.item(i);
    if (p) out.push(p);
  }
  return out;
}

function classList(target: HTMLElement): string[] {
  return (target.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

function computedDeclaredProps(target: HTMLElement): Decl[] {
  const computed = getComputedStyle(target);
  const props = new Set<string>();
  for (const p of inlineProps(target)) props.add(p);
  for (const cls of classList(target)) {
    const classProps = lookupClassRuleProps(cls) ?? [];
    for (const p of classProps) props.add(p);
  }
  return Array.from(props)
    .sort()
    .map((p) => [p, computed.getPropertyValue(p).trim()] as Decl);
}

function twItems(target: HTMLElement): TwItem[] {
  const computed = getComputedStyle(target);
  const classes = classList(target);
  const inline = inlineProps(target);

  const owner = new Map<string, string>();
  const classProps = new Map<string, string[]>();
  for (const cls of classes) {
    const ps = lookupClassRuleProps(cls) ?? [];
    classProps.set(cls, ps);
    for (const p of ps) owner.set(p, cls);
  }
  for (const p of inline) owner.set(p, '(inline)');

  const items: TwItem[] = [];
  for (const cls of classes) {
    const won = (classProps.get(cls) ?? []).filter((p) => owner.get(p) === cls);
    items.push({
      className: cls,
      decls: won.map((p) => [p, computed.getPropertyValue(p).trim()] as Decl),
      source: 'class',
    });
  }
  if (inline.length > 0) {
    items.push({
      className: '(inline)',
      decls: inline.map((p) => [p, computed.getPropertyValue(p).trim()] as Decl),
      source: 'inline',
    });
  }
  return items;
}

const DeclLine: React.FC<{ prop: string; value: string }> = ({ prop, value }) => (
  <div className="dv-code-decl">
    <span className="dv-tok-prop">{prop}</span>
    <span className="dv-tok-punct">: </span>
    <span className="dv-tok-val">{value}</span>
    <span className="dv-tok-punct">;</span>
  </div>
);

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard refused (no permission / non-secure) — silent best-effort
    // is fine here; nothing else depends on success.
  }
}

const LANG_ITEMS: ReadonlyArray<{ value: Lang; label: string }> = [
  { value: 'css', label: 'CSS' },
  { value: 'tailwind', label: 'TW' },
];

export const CodeBlock = observer(({ target }: Props) => {
  const [lang, setLang] = React.useState<Lang>('css');

  // Re-read on every render — inline style + host stylesheets can change
  // between renders (other panels write inline). Memoising would let the
  // view drift behind ChangeLog.
  const cssDecls = lang === 'css' ? computedDeclaredProps(target) : null;
  const tw = lang === 'tailwind' ? twItems(target) : null;

  const handleCopy = (): void => {
    if (tw) {
      const joined = tw
        .filter((i) => i.source === 'class')
        .map((i) => i.className)
        .join(' ');
      void copyText(joined);
      return;
    }
    if (cssDecls) {
      void copyText(cssDecls.map(([p, v]) => `${p}: ${v};`).join('\n'));
    }
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
      {cssDecls && (
        <div className="dv-code-block" data-testid="paperx-v2-code-css-list">
          {cssDecls.length === 0 ? (
            <div className="dv-code-line">
              <span className="dv-tok-muted">(no styled properties)</span>
            </div>
          ) : (
            cssDecls.map(([prop, value]) => (
              <DeclLine key={prop} prop={prop} value={value} />
            ))
          )}
        </div>
      )}
      {tw && (
        <div className="dv-code-block" data-testid="paperx-v2-code-tw-list">
          {tw.length === 0 ? (
            <div className="dv-code-line">
              <span className="dv-tok-muted">(no class or inline style)</span>
            </div>
          ) : (
            tw.map((it, i) => (
              <div
                key={`${it.className}-${i}`}
                className="dv-code-tw-item"
                data-source={it.source}
              >
                <div className="dv-code-tw-name">{it.className}</div>
                <div className="dv-code-tw-css">
                  {it.decls.length === 0 ? (
                    <span className="dv-tok-muted">— overridden —</span>
                  ) : (
                    it.decls.map(([prop, value]) => (
                      <DeclLine key={prop} prop={prop} value={value} />
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Section>
  );
});
CodeBlock.displayName = 'CodeBlock';
