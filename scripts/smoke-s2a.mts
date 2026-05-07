/**
 * S2-A smoke harness — drives JsonPromptExporter end-to-end without
 * the DI container so we don\'t need reflect-metadata wiring or jsdom.
 *
 * Construct a minimal ChangeLogService with synthetic records:
 *   - elA (data-uid="abc", DIV): two `color` edits + one `font-size` edit
 *   - elB (no uid, SPAN): one `font-size` edit
 *
 * Assert v1 schema invariants:
 *   - exactly 2 unique targets
 *   - target abc has 2 changes (color + font-size, post-dedup)
 *   - color.before === \'red\' (first), color.after === \'green\' (last)
 *   - summary.totalChanges === 3
 *   - exporter.exportToClipboard() returns a structured error in node
 *     (no clipboard available) — the point is to confirm it doesn\'t
 *     throw.
 *
 * Run:  bun run scripts/smoke-s2a.mts
 * Exit: 0 + "SMOKE_OK" on success; non-zero on failure.
 */
import 'reflect-metadata';
import {
  ChangeLogService,
  type ChangeRecord,
} from '../src/shared/services/ChangeLogService';
import { JsonPromptExporter } from '../src/shared/services/JsonPromptExporter';

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `assertion failed: ${label}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`,
    );
  }
}

/**
 * Stub HTMLElement just rich enough for buildSelector / readDataUid /
 * isConnected / tagName lookups. We do NOT pull in jsdom — the test
 * is supposed to be hermetic.
 */
function makeStubElement(opts: {
  tag: string;
  uid?: string;
  classes?: readonly string[];
}): HTMLElement {
  const attrs = new Map<string, string>();
  if (opts.uid) attrs.set('data-uid', opts.uid);
  const classList = {
    length: opts.classes?.length ?? 0,
    [Symbol.iterator]: function* (): IterableIterator<string> {
      for (const c of opts.classes ?? []) yield c;
    },
  } as unknown as DOMTokenList;
  const el = {
    nodeType: 1,
    tagName: opts.tag.toUpperCase(),
    id: '',
    classList,
    parentElement: null,
    isConnected: true,
    getAttribute(name: string): string | null {
      return attrs.get(name) ?? null;
    },
    style: {
      _store: new Map<string, string>(),
      setProperty(prop: string, value: string): void {
        this._store.set(prop, value);
      },
      getPropertyValue(prop: string): string {
        return this._store.get(prop) ?? '';
      },
      removeProperty(prop: string): void {
        this._store.delete(prop);
      },
    },
  };
  return el as unknown as HTMLElement;
}

function makeRecord(
  partial: Partial<ChangeRecord> & {
    selector: string;
    property: string;
    before: string;
    after: string;
  },
  ts: number,
): ChangeRecord {
  return {
    id: `chg-${ts}-${Math.random().toString(36).slice(2, 6)}`,
    ts,
    selector: partial.selector,
    property: partial.property,
    before: partial.before,
    after: partial.after,
    mode: partial.mode ?? 'design',
  };
}

async function main(): Promise<void> {
  const log = new ChangeLogService();

  const elA = makeStubElement({ tag: 'div', uid: 'abc' });
  const elB = makeStubElement({ tag: 'span' });

  const records: ChangeRecord[] = [
    makeRecord(
      { selector: 'div', property: 'color', before: 'red', after: 'blue' },
      1000,
    ),
    makeRecord(
      { selector: 'div', property: 'color', before: 'blue', after: 'green' },
      2000,
    ),
    makeRecord(
      { selector: 'div', property: 'font-size', before: '12px', after: '14px' },
      3000,
    ),
    makeRecord(
      { selector: 'span', property: 'font-size', before: '10px', after: '11px' },
      4000,
    ),
  ];
  for (const r of records.slice(0, 3)) {
    log.append(r);
    log.attachTarget(r.id, elA);
  }
  log.append(records[3]!);
  log.attachTarget(records[3]!.id, elB);

  const exporter = new JsonPromptExporter(log);
  const prompt = exporter.build();

  // Schema invariants
  assertEq(prompt.version, 1, 'prompt.version');
  assertEq(prompt.schema, 'paperx-prompt-v1', 'prompt.schema');
  assertEq(prompt.source, 'paperx-extension', 'prompt.source');
  assertEq(prompt.targets.length, 2, 'prompt.targets.length');
  assertEq(prompt.summary.uniqueTargets, 2, 'summary.uniqueTargets');
  assertEq(prompt.summary.totalChanges, 3, 'summary.totalChanges');
  assertEq(prompt.meta.changeCount, 3, 'meta.changeCount');

  // Locate target abc (the DIV with uid)
  const tA = prompt.targets.find((t) => t.dataUid === 'abc');
  if (!tA) throw new Error('target abc missing from prompt.targets');
  assertEq(tA.tagName, 'div', 'tA.tagName');
  assertEq(tA.changes.length, 2, 'tA.changes.length (color + font-size)');
  // Properties are sorted alphabetically, so color comes before font-size
  assertEq(tA.changes[0]!.property, 'color', 'tA.changes[0].property');
  assertEq(tA.changes[0]!.before, 'red', 'tA.changes[0].before (first record)');
  assertEq(tA.changes[0]!.after, 'green', 'tA.changes[0].after (last record)');
  assertEq(
    tA.changes[0]!.appliedAs,
    'inline-style',
    'tA.changes[0].appliedAs',
  );
  assertEq(tA.changes[0]!.mode, 'design', 'tA.changes[0].mode');
  assertEq(
    tA.changes[1]!.property,
    'font-size',
    'tA.changes[1].property',
  );

  // Locate target B (the SPAN, no uid)
  const tB = prompt.targets.find((t) => t.dataUid === null);
  if (!tB) throw new Error('null-uid target missing');
  assertEq(tB.tagName, 'span', 'tB.tagName');
  assertEq(tB.changes.length, 1, 'tB.changes.length');

  // Clipboard path in node (no navigator/document) should resolve to
  // a structured error — never throw.
  const exportRes = await exporter.exportToClipboard();
  if (exportRes.ok) {
    throw new Error(
      'expected exportToClipboard to fail in node (no clipboard available)',
    );
  }
  // Sanity: the JSON serializes
  const json = JSON.stringify(prompt, null, 2);
  if (json.length < 100) {
    throw new Error(`prompt JSON too small: ${json.length} bytes`);
  }

  // Echo the JSON for human review (parent agent reads stdout).
  console.log('--- prompt JSON ---');
  console.log(json);
  console.log('--- end ---');
  console.log('SMOKE_OK');
}

main().catch((err) => {
  console.error('SMOKE_FAIL', err);
  process.exit(1);
});
