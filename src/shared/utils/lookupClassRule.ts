/**
 * Resolve a single CSS class name to declarations from the host page's
 * stylesheets. Returns the merged cssText of every matching rule, joined
 * in document/cascade order so the last declaration wins per property.
 * Returns `null` when no rule matches.
 *
 * Why this exists: the design-v2 Inspect panel's Tailwind view needs to
 * surface what each class actually resolves to in the live document. We
 * read from `document.styleSheets` (which includes <link>, <style>, and
 * shadow-root sheets) rather than running a tailwindcss parser.
 *
 * Constraints:
 * - Cross-origin sheets throw on `.cssRules` — wrapped in try/catch and
 *   skipped silently. CDN-hosted Tailwind is the typical case.
 * - Selector match uses `CSS.escape` so arbitrary-value Tailwind classes
 *   like `rounded-[8px]` match their escaped selector `.rounded-\[8px\]`.
 * - Only exact single-class selectors are accepted; compound selectors
 *   (`.a.b`, `.a > .b`, `.a:hover`) are skipped so we never mis-attribute
 *   shared declarations to a single class.
 */
export function lookupClassRule(className: string): string | null {
  if (!className) return null;
  let selector: string;
  try {
    selector = `.${CSS.escape(className)}`;
  } catch {
    return null;
  }
  const decls: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      if (rule.selectorText !== selector) continue;
      const css = rule.style.cssText.trim();
      if (css) decls.push(css);
    }
  }
  return decls.length ? decls.join(' ') : null;
}
