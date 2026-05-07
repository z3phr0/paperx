/**
 * babel-plugin-paperx-uid (R2 stub, Phase 1)
 *
 * Goal: at compile time, inject a stable `data-paperx-uid` attribute on
 * every JSX host element so the runtime change-log can map a DOM node
 * back to (file, line, component) and the JSON Prompt can drive
 * Claude Code to the source file.
 *
 * Phase 1 scope: this stub demonstrates the visitor + uid-hash strategy
 * but is NOT yet wired into any build. End users adopt it in Phase 2 by
 * adding it to *their own* React project's babel/vite config:
 *
 *   // vite.config.ts (user side)
 *   import paperxUid from 'babel-plugin-paperx-uid';
 *   react({ babel: { plugins: [paperxUid] } })
 *
 * Fallback (when users cannot install the plugin) is runtime Fiber
 * traversal — see docs/architecture.md R2.
 */
'use strict';

const crypto = require('node:crypto');

const ATTR = 'data-paperx-uid';

function uidFor(filename, line, column, name) {
  const h = crypto.createHash('sha1');
  h.update(`${filename}:${line}:${column}:${name}`);
  return h.digest('hex').slice(0, 10);
}

module.exports = function paperxUidPlugin({ types: t }) {
  return {
    name: 'babel-plugin-paperx-uid',
    visitor: {
      JSXOpeningElement(path, state) {
        const node = path.node;
        // Only host (lowercase) elements: div, span, button, ...
        // Component elements (Capitalized) are skipped — their host
        // children will be tagged when they render.
        if (node.name.type !== 'JSXIdentifier') return;
        const tag = node.name.name;
        if (!/^[a-z]/.test(tag)) return;

        // Skip if already tagged (idempotent for re-runs).
        const has = node.attributes.some(
          (a) =>
            a.type === 'JSXAttribute' &&
            a.name &&
            a.name.type === 'JSXIdentifier' &&
            a.name.name === ATTR,
        );
        if (has) return;

        const filename = state.filename || 'anon';
        const loc = node.loc && node.loc.start;
        const line = loc ? loc.line : 0;
        const column = loc ? loc.column : 0;
        const uid = uidFor(filename, line, column, tag);

        node.attributes.push(
          t.jsxAttribute(t.jsxIdentifier(ATTR), t.stringLiteral(uid)),
        );
      },
    },
  };
};

module.exports.ATTR = ATTR;
module.exports.uidFor = uidFor;
