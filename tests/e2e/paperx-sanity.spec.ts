/**
 * paperx Sprint 3 / S3-A — end-to-end sanity suite.
 *
 * Three tests, each loading the BUILT extension from `dist/` into a real
 * Chromium via `chromium.launchPersistentContext` + the
 * --load-extension flag. We do not use Playwright's default browser
 * fixture because MV3 extensions cannot be installed any other way.
 *
 * Tests:
 *   1. Toolbar renders with 4 mode buttons + history + close.
 *   2. Design mode picker selects a host-page element and DesignPanel
 *      reflects its size.
 *   3. Editing font-size in DesignPanel updates the element, the
 *      ChangeLog drawer records it, and Export Prompt copies a v1
 *      JSON payload to the clipboard.
 *
 * Locator strategy:
 *   - Playwright's default selectors auto-pierce open Shadow DOM, so
 *     we can reach paperx-root descendants directly.
 *   - data-testid attributes on toolbar / mode / history / close /
 *     export-prompt give us stable hooks; everything else uses
 *     ARIA + role to stay loose.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(REPO_ROOT, 'dist');
const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/sample.html');
const FIXTURE_URL = `file://${FIXTURE_PATH}`;

async function launchWithExtension(): Promise<BrowserContext> {
  // headed mode: MV3 extensions need a real browser process. Playwright
  // will run it offscreen on most macOS dev boxes; we keep it explicit
  // to make debugging straightforward.
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
    ],
  });
  // Grant clipboard so test 3 can read what Export Prompt wrote.
  // file:// origin needs `null` per Chrome (or the literal "null"
  // string Playwright accepts via the `origin` field). We grant
  // unscoped — sanity suite, not security-critical.
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  return ctx;
}

async function getServiceWorker(ctx: BrowserContext) {
  const existing = ctx.serviceWorkers()[0];
  if (existing) return existing;
  return await ctx.waitForEvent('serviceworker', { timeout: 10_000 });
}

/**
 * v0.7.0+: paperx is OFF on every newly opened tab by default. The SW
 * owns per-tab state in an in-memory map. Playwright key events don't
 * reach Chrome's commands dispatcher, so we drive state via the
 * `__paperxSetTabEnabled` hook exposed on the SW's globalThis.
 */
async function enablePaperxOnPage(ctx: BrowserContext, page: Page): Promise<void> {
  const worker = await getServiceWorker(ctx);
  // Bring the page to focus so chrome.tabs.query({active:true}) returns it.
  await page.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  });
  if (tabId == null) throw new Error('enablePaperxOnPage: no active tab');
  await worker.evaluate(
    async (id) => {
      const setEnabled = (globalThis as Record<string, unknown>)['__paperxSetTabEnabled'];
      if (typeof setEnabled === 'function') {
        await (setEnabled as (id: number, value: boolean) => Promise<void>)(id, true);
      }
    },
    tabId,
  );
  await page.locator('paperx-root').waitFor({ state: 'attached', timeout: 10_000 });
  await page.locator('[data-testid="paperx-toolbar"]').waitFor({ timeout: 10_000 });
}

async function openFixture(ctx: BrowserContext): Promise<Page> {
  // Persistent context spawns with a default about:blank tab; reuse it
  // when present, otherwise open a new one.
  const existing = ctx.pages()[0];
  const page = existing ?? (await ctx.newPage());
  await page.goto(FIXTURE_URL);
  // v0.7.0: paperx is off by default on every tab — explicitly enable
  // for the fixture before the toolbar can be expected.
  await enablePaperxOnPage(ctx, page);
  return page;
}

test.describe('paperx sanity (Sprint 3 / S3-A)', () => {
  test('toolbar renders with all mode + history + close buttons', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      const toolbar = page.locator('[data-testid="paperx-toolbar"]');
      await expect(toolbar).toBeVisible();

      // 4 mode buttons
      for (const m of ['design', 'ruler', 'comment', 'transition'] as const) {
        await expect(page.locator(`[data-testid="paperx-mode-${m}"]`)).toBeVisible();
      }

      await expect(page.locator('[data-testid="paperx-history"]')).toBeVisible();
      await expect(page.locator('[data-testid="paperx-close"]')).toBeVisible();

      // z-index sanity — the toolbar pill claims max int32 inline-class.
      // We verify via computed style rather than parsing the className.
      const zIndex = await toolbar.evaluate((el) => getComputedStyle(el).zIndex);
      expect(zIndex).toBe('2147483647');
    } finally {
      await ctx.close();
    }
  });

  // V1 DesignPanel retired in design-v2 sprint. The 'Selection' header
  // + numeric W input pattern is V1-specific (V2 renders [Design |
  // Inspect] sub-tabs and a `<input>` text field). Coverage for "panel
  // mounts on selection in design mode" lives in the V2 smoke test.
  test.skip('design mode picker selects element and DesignPanel reflects size', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      // Enter design mode.
      await page.locator('[data-testid="paperx-mode-design"]').click();

      const target = page.locator('[data-uid="hero-title-001"]');
      await target.hover();

      // Click via the picker. ElementPicker's window-level capture
      // listener will swallow the click and route it through
      // SelectionStore. We use force:true so Playwright doesn't wait
      // for actionability checks that the picker overlay would
      // otherwise satisfy.
      await target.click();

      // DesignPanel mounts only when mode='design' and selection !== null.
      // Its header always contains the literal "Selection" label.
      const panelHeader = page.locator('paperx-root').getByText('Selection', { exact: true });
      await expect(panelHeader).toBeVisible({ timeout: 5_000 });

      // Size section: the W input should reflect the h1's bounding rect
      // width. We don't pin the exact px (browsers vary) — just assert
      // a positive integer was seeded.
      const sizeRow = page.locator('paperx-root').getByText('W', { exact: true }).locator('..');
      const widthInput = sizeRow.locator('input[type="number"]').first();
      await expect(widthInput).toBeVisible();
      const widthVal = await widthInput.inputValue();
      const widthNum = Number.parseFloat(widthVal);
      expect(Number.isFinite(widthNum)).toBe(true);
      expect(widthNum).toBeGreaterThan(0);
    } finally {
      await ctx.close();
    }
  });

  // V1 Typography section retired in design-v2 sprint; V2 phase 1 does
  // not include Typography. Font-size editing path will be reinstated
  // alongside the V2 Typography section in a follow-up.
  test.skip('edit font-size + ChangeLog records it + Export Prompt copies v1 JSON', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      // Enter design mode and select the button.
      await page.locator('[data-testid="paperx-mode-design"]').click();
      const button = page.locator('[data-uid="cta-btn-003"]');
      await button.click();

      const panelHeader = page.locator('paperx-root').getByText('Selection', { exact: true });
      await expect(panelHeader).toBeVisible({ timeout: 5_000 });

      // Locate the Typography "Size" row's input. The Label component
      // renders the literal text "Size"; its parent row contains the
      // companion <input>.
      const sizeRow = page.locator('paperx-root').getByText('Size', { exact: true }).locator('..');
      const fontSizeInput = sizeRow.locator('input').first();
      await expect(fontSizeInput).toBeVisible();

      // Replace the value and commit. Typography Field commits on each
      // onChange so blur/Enter aren't required, but we Tab out for
      // realism.
      await fontSizeInput.fill('20px');
      await fontSizeInput.press('Tab');

      // Verify the inline style on the actual button.
      await expect
        .poll(
          async () =>
            button.evaluate((el) => (el as HTMLElement).style.fontSize),
          { timeout: 5_000 },
        )
        .toBe('20px');

      // Open the ChangeLog drawer.
      await page.locator('[data-testid="paperx-history"]').click();
      // The drawer header carries "Change log" text — wait for it.
      await expect(
        page.locator('paperx-root').getByText('Change log', { exact: true }),
      ).toBeVisible();

      // At least one row should mention font-size.
      const rows = page.locator('paperx-root [role="row"]');
      await expect(rows.first()).toBeVisible({ timeout: 5_000 });
      const rowsText = await rows.allInnerTexts();
      expect(rowsText.some((t) => t.includes('font-size'))).toBe(true);

      // Click Export Prompt and read the clipboard.
      const exportBtn = page.locator('[data-testid="paperx-export-prompt"]');
      await expect(exportBtn).toBeEnabled();
      await exportBtn.click();

      const clipboardText = await page.evaluate(
        async () => await navigator.clipboard.readText(),
      );
      expect(clipboardText.length).toBeGreaterThan(0);
      // S3-B: clipboard is now pure paperx-prompt-v1 JSON — no
      // markdown fence, no preamble. Substring check first as a
      // cheap identity proof, then full JSON.parse for the round-
      // trip assertion.
      expect(clipboardText).toContain('"schema": "paperx-prompt-v1"');
      const parsed = JSON.parse(clipboardText);
      expect(parsed.schema).toBe('paperx-prompt-v1');
      expect(Array.isArray(parsed.targets)).toBe(true);
      expect(parsed.targets.length).toBeGreaterThan(0);
      const buttonTarget = parsed.targets.find(
        (t: { dataUid: string | null }) => t.dataUid === 'cta-btn-003',
      );
      expect(buttonTarget).toBeTruthy();
      const fontChange = buttonTarget.changes.find(
        (c: { property: string }) => c.property === 'font-size',
      );
      expect(fontChange).toBeTruthy();
      expect(fontChange.after).toBe('20px');
    } finally {
      await ctx.close();
    }
  });

  // V1 RulerPanel retired in design-v2: ruler mode now shows the V2
  // Inspect view (BoxModel + CSS/TW/JSX code block) inside the V2
  // inspector. The "Bounding box" / "Viewport offsets" section grammar
  // is V1-only. New V2 ruler smoke (see "design-v2 ruler" describe)
  // covers the equivalent panel-mount-on-selection flow.
  test.skip('ruler mode renders read-only measurements for the selected element', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-ruler"]').click();
      await page.locator('[data-uid="hero-title-001"]').click();

      const panel = page.locator('[data-testid="paperx-ruler-panel"]');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      // Section headers from the read-only readout.
      await expect(panel.getByText('Bounding box', { exact: true })).toBeVisible();
      await expect(panel.getByText('Viewport offsets', { exact: true })).toBeVisible();

      // Width row should report a positive non-zero pixel value.
      const widthRow = panel.getByText('Width', { exact: true }).locator('..');
      const widthText = (await widthRow.innerText()).trim();
      const widthMatch = widthText.match(/([\d.]+)\s*px/);
      expect(widthMatch).not.toBeNull();
      expect(Number.parseFloat(widthMatch![1]!)).toBeGreaterThan(0);
    } finally {
      await ctx.close();
    }
  });

  test('comment mode adds a note and lists it under the selected element', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-comment"]').click();
      await page.locator('[data-uid="hero-desc-002"]').click();

      const panel = page.locator('[data-testid="paperx-comment-panel"]');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      const NOTE = 'needs more contrast';
      await page.locator('[data-testid="paperx-comment-input"]').fill(NOTE);
      await page.locator('[data-testid="paperx-comment-submit"]').click();

      // Listed comment text must appear, count line should reflect it.
      await expect(panel.getByText(NOTE, { exact: false })).toBeVisible();
      await expect(panel.getByText('Comments here (1)', { exact: false })).toBeVisible();
      // Submitting an empty draft was already disabled; submitting clears
      // the draft. A second submit attempt without re-entering text
      // should be a no-op (button disabled), so the count stays at 1.
      await expect(page.locator('[data-testid="paperx-comment-submit"]')).toBeDisabled();
    } finally {
      await ctx.close();
    }
  });

  test('snap engine: dragging E handle near a sibling edge surfaces a magenta guide and snaps the width', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();

      const left = page.locator('[data-uid="snap-A-100"]');
      const right = page.locator('[data-uid="snap-B-200"]');

      // Geometry sanity from the fixture: read both rects in the page
      // so the test stays robust if the fixture's margins ever change.
      const beforeRects = await page.evaluate(() => {
        const a = document.querySelector('[data-uid="snap-A-100"]')!.getBoundingClientRect();
        const b = document.querySelector('[data-uid="snap-B-200"]')!.getBoundingClientRect();
        return { a: { left: a.left, right: a.right }, b: { left: b.left, right: b.right } };
      });
      // The 60 px flex gap means b.left - a.right is exactly the gap.
      const gap = beforeRects.b.left - beforeRects.a.right;
      expect(gap).toBeGreaterThan(20);

      // Select the LEFT block, then drag its E handle rightward — its
      // right edge should snap to the right block's left edge once we
      // approach within 4 px. We aim slightly past the snap zone (gap
      // + 1 px) so the engine has to actively snap us back.
      await left.click();
      const handle = page.locator('[data-testid="paperx-resize-e"]');
      await expect(handle).toBeVisible({ timeout: 5_000 });
      const hb = await handle.boundingBox();
      expect(hb).not.toBeNull();

      const startX = hb!.x + hb!.width / 2;
      const startY = hb!.y + hb!.height / 2;
      const targetX = startX + gap + 1;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Step in chunks so the snap engine sees a frame inside the snap
      // zone (it only locks while we are within threshold).
      await page.mouse.move(startX + Math.round(gap / 2), startY, { steps: 6 });
      await page.mouse.move(targetX, startY, { steps: 8 });

      // While still pressed (no mouseup yet) the magenta guide must
      // exist at the snap X. We use `toBeAttached` rather than
      // `toBeVisible` because SVG <line> elements don't satisfy
      // Playwright's layout-box-based visibility heuristic even when
      // they paint correctly. We verify the geometry via x1.
      const guide = page.locator('[data-testid="paperx-snap-guide-x"]');
      await expect(guide).toBeAttached({ timeout: 1_000 });
      const x1 = await guide.getAttribute('x1');
      expect(Number(x1)).toBeCloseTo(beforeRects.b.left, 0);

      await page.mouse.up();

      // The guide is detached the moment commit starts.
      await expect(guide).not.toBeAttached();

      // Final inline width: A's right edge should be aligned with B's
      // left edge ± 1 px (rounding tolerance from the engine).
      const after = await page.evaluate(() => {
        const a = document.querySelector('[data-uid="snap-A-100"]')!.getBoundingClientRect();
        const b = document.querySelector('[data-uid="snap-B-200"]')!.getBoundingClientRect();
        return { aRight: a.right, bLeft: b.left };
      });
      expect(Math.abs(after.aRight - after.bLeft)).toBeLessThanOrEqual(1);
    } finally {
      await ctx.close();
    }
  });

  test('design mode rotate handle drag writes transform: rotate to inline style', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      const handle = page.locator('[data-testid="paperx-rotate-handle"]');
      await expect(handle).toBeVisible({ timeout: 5_000 });

      const handleBox = await handle.boundingBox();
      expect(handleBox).not.toBeNull();
      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;

      // Drag the handle ~80px to the right of its anchor — given the
      // handle sits above the element's top-center, this is a clear
      // clockwise sweep that should land somewhere in (10°, 90°).
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 40, startY + 10, { steps: 5 });
      await page.mouse.move(startX + 80, startY + 40, { steps: 8 });
      await page.mouse.up();

      // Inline transform should now contain rotate(...deg) post-commit.
      await expect
        .poll(
          async () =>
            target.evaluate((el) => (el as HTMLElement).style.transform),
          { timeout: 5_000 },
        )
        .toMatch(/rotate\(-?\d+(\.\d+)?deg\)/);
    } finally {
      await ctx.close();
    }
  });

  test('design mode resize handles drag SE corner → width+height edits in ChangeLog', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      // 8 handles must be present once the element is selected.
      await expect(page.locator('[data-testid="paperx-resize-se"]')).toBeVisible({ timeout: 5_000 });
      for (const h of ['nw', 'n', 'ne', 'e', 's', 'sw', 'w'] as const) {
        await expect(page.locator(`[data-testid="paperx-resize-${h}"]`)).toBeVisible();
      }

      const startBox = await target.boundingBox();
      expect(startBox).not.toBeNull();
      const handle = page.locator('[data-testid="paperx-resize-se"]');
      const handleBox = await handle.boundingBox();
      expect(handleBox).not.toBeNull();

      // Drag SE corner +40px in both dimensions.
      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 20, startY + 20, { steps: 5 });
      await page.mouse.move(startX + 40, startY + 40, { steps: 10 });
      await page.mouse.up();

      // Live preview is reverted on mouseup; final inline width/height
      // must be set via StyleEditService.apply, leaving them as
      // explicit pixel strings.
      await expect
        .poll(
          async () =>
            target.evaluate((el) => {
              const s = (el as HTMLElement).style;
              return { w: s.width, h: s.height };
            }),
          { timeout: 5_000 },
        )
        .toMatchObject({ w: /\d+px/, h: /\d+px/ });

      // ChangeLog drawer body is default-collapsed (v0.11.10) — click the
      // drawer's own chevron to expand it. The toolbar History button
      // toggles panel visibility, not body collapse.
      await page.locator('[data-testid="paperx-changelog-collapse"]').click();
      const rows = page.locator('paperx-root [role="row"]');
      await expect(rows.first()).toBeVisible({ timeout: 5_000 });
      const rowsText = await rows.allInnerTexts();
      expect(rowsText.some((t) => t.includes('width'))).toBe(true);
      expect(rowsText.some((t) => t.includes('height'))).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  test('ruler mode renders top + left viewport rulers with pixel labels', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-ruler"]').click();

      const top = page.locator('[data-testid="paperx-ruler-top"]');
      const left = page.locator('[data-testid="paperx-ruler-left"]');
      await expect(top).toBeVisible({ timeout: 5_000 });
      await expect(left).toBeVisible();

      // Major-tick labels: 100 must be present in both rulers since the
      // sanity viewport is 1280x800.
      await expect(top.getByText('100', { exact: true })).toBeVisible();
      await expect(left.getByText('100', { exact: true })).toBeVisible();

      // Switching out of ruler mode should hide the rulers entirely.
      await page.locator('[data-testid="paperx-mode-design"]').click();
      await expect(top).toBeHidden();
      await expect(left).toBeHidden();
    } finally {
      await ctx.close();
    }
  });

  test('hover tooltip shows tag + dimensions for the hovered element', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      // v0.7.0: picker is gated on a non-null mode — pick design first.
      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="hero-title-001"]');
      await target.hover();

      const tip = page.locator('[data-testid="paperx-hover-tooltip"]');
      await expect(tip).toBeVisible({ timeout: 5_000 });
      const text = await tip.innerText();
      expect(text.toLowerCase()).toContain('h1');
      // Dimensions row uses ' × ' as the separator; assert the literal.
      expect(text).toMatch(/\d+px\s*×\s*\d+px/);
    } finally {
      await ctx.close();
    }
  });

});

/**
 * Sprint 2 — Figma BoxModel + Flex/Grid panels.
 *
 * Each test exercises the new Sprint 2 surface:
 *   1. BoxModel width input writes inline style.width.
 *   2. Padding link toggle broadcasts one numeric edit to all 4 sides.
 *   3. Flex justify quick-button writes justify-content.
 *   4. Grid template-cols input writes grid-template-columns.
 */
test.describe('paperx Sprint 2 (B + C)', () => {
  // V1 BoxModel retired in design-v2 sprint. V2 Frame section is the
  // analog: width/height inputs commit through the same StyleEditService
  // path. New V2 smoke test covers the width-edit ChangeLog flow.
  test.skip('BoxModel: editing W writes inline width and surfaces a ChangeLog row', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      const wInput = page.locator('[data-testid="paperx-boxmodel-w"]');
      await expect(wInput).toBeVisible({ timeout: 5_000 });
      await wInput.fill('123');
      await wInput.press('Tab');

      await expect
        .poll(async () => target.evaluate((el) => (el as HTMLElement).style.width), {
          timeout: 5_000,
        })
        .toBe('123px');

      await page.locator('[data-testid="paperx-history"]').click();
      const rows = page.locator('paperx-root [role="row"]');
      await expect(rows.first()).toBeVisible({ timeout: 5_000 });
      const rowsText = await rows.allInnerTexts();
      expect(rowsText.some((t) => t.includes('width'))).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  // V1 BoxModel retired in design-v2 sprint. V2 Frame section's
  // Padding row has an expand toggle (corners-individual ↔ pad-all) that
  // achieves the same broadcast/independent semantics with different
  // testids; coverage lives in the V2 smoke test.
  test.skip('BoxModel: padding link toggle broadcasts to all 4 sides', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      // Toggle link mode FIRST so the next single-cell edit broadcasts.
      const linkToggle = page.locator('[data-testid="paperx-boxmodel-link-padding"]');
      await expect(linkToggle).toBeVisible({ timeout: 5_000 });
      await linkToggle.click();

      const ptInput = page.locator('[data-testid="paperx-boxmodel-pt"]');
      await ptInput.fill('20');
      await ptInput.press('Tab');

      // All four padding sides should be 20px.
      await expect
        .poll(
          async () =>
            target.evaluate((el) => {
              const s = (el as HTMLElement).style;
              return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
            }),
          { timeout: 5_000 },
        )
        .toEqual(['20px', '20px', '20px', '20px']);

      await page.locator('[data-testid="paperx-history"]').click();
      const rows = page.locator('paperx-root [role="row"]');
      await expect(rows.first()).toBeVisible({ timeout: 5_000 });
      const rowsText = await rows.allInnerTexts();
      const paddingRows = rowsText.filter((t) => /padding-(top|right|bottom|left)/.test(t));
      expect(paddingRows.length).toBeGreaterThanOrEqual(4);
    } finally {
      await ctx.close();
    }
  });

});

/**
 * Sprint 3 — Transition panel + Background/Border/Effects sections,
 * built on the BezierEditor and GradientEditor primitives.
 */
test.describe('paperx Sprint 3 (F + G)', () => {
  test('Transition: mode opens panel + bezier preset writes cubic-bezier', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-transition"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      const panel = page.locator('[data-testid="paperx-transition-panel"]');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      // Click the "ease-in" preset and assert the timing function commits.
      await page.locator('[data-testid="paperx-bezier-preset-ease-in"]').click();

      await expect
        .poll(
          async () =>
            target.evaluate(
              (el) => (el as HTMLElement).style.transitionTimingFunction,
            ),
          { timeout: 5_000 },
        )
        .toMatch(/^cubic-bezier\(/);

      // ChangeLog drawer body is default-collapsed (v0.11.10) — expand it.
      await page.locator('[data-testid="paperx-changelog-collapse"]').click();
      const rows = page.locator('paperx-root [role="row"]');
      await expect(rows.first()).toBeVisible({ timeout: 5_000 });
      const rowsText = await rows.allInnerTexts();
      expect(rowsText.some((t) => t.includes('transition-timing-function'))).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  // V1 Background section retired in design-v2 sprint. V2 Fill section
  // exposes Solid / Gradient / Image as a top tab strip; Gradient/Image
  // are visual-only this period, so gradient-write coverage is parked
  // until the V2 Fill writer is implemented.
  test.skip('Background: switching to gradient type surfaces the gradient editor', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      const gradientType = page.locator('[data-testid="paperx-bg-type-gradient"]');
      await expect(gradientType).toBeVisible({ timeout: 5_000 });
      await gradientType.click();

      // The GradientEditor primitive renders its canvas as soon as the
      // gradient mode is active.
      await expect(
        page.locator('[data-testid="paperx-gradient-canvas"]'),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        page.locator('[data-testid="paperx-gradient-type-linear"]'),
      ).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('Effects: unified radius input broadcasts to all 4 corners', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      // v0.6.0: Radius starts in the empty state (no rounding) — click
      // the `+` to enable, which seeds 8px and reveals the unified input.
      // Then re-fill it to the value the assertion expects.
      await page.locator('[data-testid="paperx-radius-add"]').click({ timeout: 5_000 });
      const unifiedField = page.locator('[data-testid="paperx-radius-unified-input"]');
      await expect(unifiedField).toBeVisible({ timeout: 5_000 });
      // V2 testid sits on the .dv-input wrapper; the real <input> is its
      // child. fill+press semantically target the focusable input.
      const unifiedInput = unifiedField.locator('input');
      await unifiedInput.fill('12');
      await unifiedInput.press('Tab');

      await expect
        .poll(
          async () =>
            target.evaluate((el) => {
              const s = (el as HTMLElement).style;
              return [
                s.borderTopLeftRadius,
                s.borderTopRightRadius,
                s.borderBottomLeftRadius,
                s.borderBottomRightRadius,
              ];
            }),
          { timeout: 5_000 },
        )
        .toEqual(['12px', '12px', '12px', '12px']);
    } finally {
      await ctx.close();
    }
  });

  test('Effects: mode toggle flips to per-corner; single corner writes alone', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      // v0.6.0: enable Radius first (empty state hides the editor).
      await page.locator('[data-testid="paperx-radius-add"]').click({ timeout: 5_000 });
      // Default mode is unified — unified input is visible.
      await expect(page.locator('[data-testid="paperx-radius-unified-input"]')).toBeVisible({
        timeout: 5_000,
      });

      // Flip to per-corner via the top-right toggle.
      await page.locator('[data-testid="paperx-radius-mode-toggle"]').click();
      await expect(page.locator('[data-testid="paperx-radius-per-corner"]')).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.locator('[data-testid="paperx-radius-unified-input"]')).toHaveCount(0);

      // Filling only TL must NOT broadcast to other corners. The `+`
      // click above seeded all four corners to 8px, so TR stays at 8px
      // (the unchanged baseline) rather than the empty string.
      const tl = page.locator('[data-testid="paperx-radius-tl"]').locator('input');
      await tl.fill('20');
      await tl.press('Tab');

      await expect
        .poll(
          async () =>
            target.evaluate((el) => {
              const s = (el as HTMLElement).style;
              return [s.borderTopLeftRadius, s.borderTopRightRadius];
            }),
          { timeout: 5_000 },
        )
        .toEqual(['20px', '8px']);
    } finally {
      await ctx.close();
    }
  });

  test('JSON Prompt: summary.modes includes "transition" after a transition edit', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-transition"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();
      await expect(
        page.locator('[data-testid="paperx-transition-panel"]'),
      ).toBeVisible({ timeout: 5_000 });

      await page.locator('[data-testid="paperx-bezier-preset-ease"]').click();
      await expect
        .poll(
          async () =>
            target.evaluate(
              (el) => (el as HTMLElement).style.transitionTimingFunction,
            ),
          { timeout: 5_000 },
        )
        .toMatch(/^cubic-bezier\(/);

      // Expand ChangeLog body so Export Prompt becomes reachable, then
      // copy + parse clipboard JSON. (Toolbar History toggles panel
      // visibility — distinct from this body collapse since v0.11.10.)
      await page.locator('[data-testid="paperx-changelog-collapse"]').click();
      const exportBtn = page.locator('[data-testid="paperx-export-prompt"]');
      await expect(exportBtn).toBeEnabled();
      await exportBtn.click();

      const clipboardText = await page.evaluate(
        async () => await navigator.clipboard.readText(),
      );
      const parsed = JSON.parse(clipboardText);
      expect(parsed.schema).toBe('paperx-prompt-v1');
      expect(parsed.summary.modes).toContain('transition');
    } finally {
      await ctx.close();
    }
  });
});

/**
 * v0.2.1 — Comment overhaul: priority chip + Figma-style guides +
 * spacing visualization + import/export.
 */
test.describe('paperx Comment overhaul (v0.2.1)', () => {
  test('Priority chip cycles P2 → P0 → P1 on consecutive clicks', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-comment"]').click();
      await page.locator('[data-uid="cta-btn-003"]').click();

      await page.locator('[data-testid="paperx-comment-input"]').fill('check this');
      await page.locator('[data-testid="paperx-comment-submit"]').click();

      // Find the priority chip on the new comment row. It carries
      // testid paperx-comment-priority-${id}; we don't know the id, so
      // match by testid prefix.
      const chip = page.locator('[data-testid^="paperx-comment-priority-cmt-"]').first();
      await expect(chip).toBeVisible({ timeout: 5_000 });
      await expect(chip).toHaveText('P2');

      await chip.click();
      await expect(chip).toHaveText('P0');
      await chip.click();
      await expect(chip).toHaveText('P1');
      await chip.click();
      await expect(chip).toHaveText('P2');
    } finally {
      await ctx.close();
    }
  });

  test('CommentGuides: bbox dashed outline renders for selected element', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-comment"]').click();
      await page.locator('[data-uid="cta-btn-003"]').click();

      await expect(page.locator('[data-testid="paperx-comment-guides-bbox"]')).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await ctx.close();
    }
  });

  test('SpacingGuides: padding bands render for cta-btn-003 (padding 8px 16px)', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-comment"]').click();
      await page.locator('[data-uid="cta-btn-003"]').click();

      // The fixture sets padding: 8px 16px on the button, so all 4
      // padding bands should render.
      await expect(page.locator('[data-testid="paperx-spacing-padding-left"]')).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.locator('[data-testid="paperx-spacing-padding-right"]')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('Comment import: paperx-comments-v1 JSON loads via file input', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-comment"]').click();
      await page.locator('[data-uid="cta-btn-003"]').click();

      const payload = {
        schema: 'paperx-comments-v1',
        version: 1,
        generatedAt: '2026-01-01T00:00:00Z',
        source: 'paperx-extension',
        paperxVersion: '0.2.1',
        pageUrl: 'https://example.com/',
        pageTitle: 'fake',
        comments: [
          {
            id: 'cmt-fake-1',
            targetKey: 'fake-uid-1',
            targetLabel: '[data-uid="fake-1"]',
            selector: 'div.fake',
            dataUid: 'fake-uid-1',
            tagName: 'div',
            bbox: { x: 0, y: 0, w: 10, h: 10 },
            thumbnailColor: '#3b82f6',
            text: 'imported note A',
            priority: 'P0',
            ts: 1735689600000,
          },
          {
            id: 'cmt-fake-2',
            targetKey: 'fake-uid-2',
            targetLabel: '[data-uid="fake-2"]',
            selector: 'span.fake',
            dataUid: 'fake-uid-2',
            tagName: 'span',
            bbox: { x: 0, y: 0, w: 20, h: 20 },
            thumbnailColor: null,
            text: 'imported note B',
            priority: 'P1',
            ts: 1735689700000,
          },
        ],
      };

      await page.locator('[data-testid="paperx-comment-import-file"]').setInputFiles({
        name: 'paperx-comments-test.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(payload), 'utf8'),
      });

      const status = page.locator('[data-testid="paperx-comment-toast"]');
      await expect(status).toBeVisible({ timeout: 5_000 });
      await expect(status).toHaveText(/Imported 2 comments/);

      await expect(page.getByText('imported note A', { exact: false })).toBeVisible();
      await expect(page.getByText('imported note B', { exact: false })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

/**
 * v0.2.2 — Locate flash overlay + snapdom-driven thumbnail.
 */
test.describe('paperx Comment fix (v0.2.2)', () => {
  test('Locate: clicking the crosshair fires the flash overlay + toast', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-comment"]').click();
      await page.locator('[data-uid="cta-btn-003"]').click();

      await page.locator('[data-testid="paperx-comment-input"]').fill('check this');
      await page.locator('[data-testid="paperx-comment-submit"]').click();

      // Locate button is no longer hover-only; click it directly.
      await page
        .locator('[data-testid^="paperx-comment-locate-cmt-"]')
        .first()
        .click();

      await expect(page.locator('[data-testid="paperx-locate-flash"]')).toBeVisible({
        timeout: 5_000,
      });
      const toast = page.locator('[data-testid="paperx-comment-toast"]');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Located');
    } finally {
      await ctx.close();
    }
  });

  test('Locate: missing element surfaces "no longer in DOM" toast', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-comment"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      await page.locator('[data-testid="paperx-comment-input"]').fill('check this');
      await page.locator('[data-testid="paperx-comment-submit"]').click();

      // Detach the element from the DOM so the WeakRef deref still works
      // but isConnected returns false.
      await target.evaluate((el) => el.remove());

      await page
        .locator('[data-testid^="paperx-comment-locate-cmt-"]')
        .first()
        .click();

      const toast = page.locator('[data-testid="paperx-comment-toast"]');
      await expect(toast).toBeVisible({ timeout: 5_000 });
      await expect(toast).toContainText('no longer in DOM');
      await expect(page.locator('[data-testid="paperx-locate-flash"]')).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test('Thumbnail: snapdom capture replaces the skeleton with a PNG', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-comment"]').click();
      await page.locator('[data-uid="cta-btn-003"]').click();

      await page.locator('[data-testid="paperx-comment-input"]').fill('check this');
      await page.locator('[data-testid="paperx-comment-submit"]').click();

      // Capture is fire-and-forget; we wait until the PNG arrives.
      const img = page.locator('[data-testid="paperx-comment-thumb-img"]').first();
      await expect(img).toBeVisible({ timeout: 8_000 });
      const src = await img.getAttribute('src');
      expect(src).toMatch(/^data:image\/png;base64,/);
    } finally {
      await ctx.close();
    }
  });
});

/**
 * v0.7.0 — Popup operates on the active tab's per-tab enabled state.
 * Default is OFF for every newly opened tab.
 */
test.describe('paperx popup (v0.7.0 per-tab)', () => {
  test('Popup loads with OFF state on a fresh tab and the big toggle flips it', async () => {
    const ctx = await launchWithExtension();
    try {
      const sw = await getServiceWorker(ctx);
      const extId = new URL(sw.url()).host;

      // Open the popup HTML in a separate page. In Playwright this becomes
      // the active tab — the popup's chrome.tabs.query reads it as its own
      // operating target. SW returns false (default) for a never-enabled tab.
      const popup = await ctx.newPage();
      await popup.goto(`chrome-extension://${extId}/src/popup/index.html`);

      const toggle = popup.locator('[data-testid="paperx-popup-toggle"]');
      await expect(toggle).toBeVisible({ timeout: 5_000 });
      await expect(toggle).toHaveText('OFF');

      // Toggle ON via the big button — SW updates state for the popup tab.
      await toggle.click();
      await expect(toggle).toHaveText('ON', { timeout: 5_000 });

      // Toggle OFF again — round-trip.
      await toggle.click();
      await expect(toggle).toHaveText('OFF', { timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  test('SW per-tab enable hook drives content-script mount + unmount on a fixture tab', async () => {
    const ctx = await launchWithExtension();
    try {
      const fixture = ctx.pages()[0] ?? (await ctx.newPage());
      await fixture.goto(FIXTURE_URL);
      // Default OFF — paperx-root not mounted.
      await expect(fixture.locator('paperx-root')).toHaveCount(0, { timeout: 3_000 });

      // Enable via the SW test hook.
      await enablePaperxOnPage(ctx, fixture);
      await expect(fixture.locator('[data-testid="paperx-toolbar"]')).toBeVisible({
        timeout: 5_000,
      });

      // Disable via the SW test hook directly.
      const worker = await getServiceWorker(ctx);
      const tabId = await worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id ?? null;
      });
      await worker.evaluate(
        async (id) => {
          const fn = (globalThis as Record<string, unknown>)['__paperxSetTabEnabled'];
          await (fn as (id: number, value: boolean) => Promise<void>)(id!, false);
        },
        tabId,
      );
      await expect(fixture.locator('paperx-root')).toHaveCount(0, { timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });
});

/**
 * v0.7.0 — Toolbar mode buttons toggle deselect when clicked twice.
 */
test.describe('paperx mode toggle (v0.7.0)', () => {
  test('Clicking the active mode button deselects the mode and hides the panel', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      const designBtn = page.locator('[data-testid="paperx-mode-design"]');
      await designBtn.click();
      await expect(designBtn).toHaveAttribute('aria-pressed', 'true');

      // Select an element so the DesignPanel mounts.
      await page.locator('[data-uid="cta-btn-003"]').click();
      await expect(page.getByRole('region', { name: 'paperx design panel' })).toBeVisible({
        timeout: 5_000,
      });

      // Click the active Design button again — toggle deselect.
      await designBtn.click();
      await expect(designBtn).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByRole('region', { name: 'paperx design panel' })).toHaveCount(0, {
        timeout: 5_000,
      });
      // Toolbar pill itself stays visible.
      await expect(page.locator('[data-testid="paperx-toolbar"]')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

/**
 * v0.8.0 / v0.10.0 — Figma + visBug-style measurement guides.
 *
 * v0.10.0 reshapes distance labels by classifying the (A, B) geometric
 * relationship (contained / vertical-gap / horizontal-gap / diagonal)
 * and rendering only the nearest-edge gap(s) for the case. Three
 * dedicated fixture pairs (`dist-wrap-A` + `dist-child-B`,
 * `dist-vstack-A` + `dist-vstack-B`, `dist-diag-A` + `dist-diag-B`)
 * give each case predictable geometry.
 */
test.describe('paperx measurement guides (v0.8.0 / v0.10.0)', () => {
  test('Hover shows 4 dashed full-viewport guides; selecting + hover shows distance labels', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      // Enter design mode so the picker activates and guides render.
      await page.locator('[data-testid="paperx-mode-design"]').click();

      // Hover element A — 4 hover guide lines appear (no selection yet,
      // no distance labels).
      const targetA = page.locator('[data-uid="hero-title-001"]');
      await targetA.hover();
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        await expect(page.locator(`[data-testid="paperx-hover-guide-${side}"]`)).toBeVisible({
          timeout: 3_000,
        });
      }
      // No distance labels rendered with nothing selected.
      await expect(page.locator('[data-testid^="paperx-distance-"]')).toHaveCount(0);

      // Select A by clicking it (picker click captures).
      await targetA.click();

      // Hover a different element B — distance labels appear in
      // addition to B's hover guides. h1 (selected) is above the button
      // with horizontal overlap → vertical-gap case → exactly 1 chip.
      const targetB = page.locator('[data-uid="cta-btn-003"]');
      await targetB.hover();
      await expect(page.locator('[data-testid="paperx-hover-guide-top"]')).toBeVisible({
        timeout: 3_000,
      });
      const labelCount = await page.locator('[data-testid^="paperx-distance-"]').count();
      expect(labelCount).toBeGreaterThanOrEqual(1);

      // Self-hover (B is now hovered AND we click to make it the
      // selection) — no distance labels (hover === selected).
      await targetB.click();
      await targetB.hover();
      await expect(page.locator('[data-testid^="paperx-distance-"]')).toHaveCount(0, {
        timeout: 3_000,
      });
    } finally {
      await ctx.close();
    }
  });

  test('Containment case: 4 inset chips, 0 alignment guides', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);
      await page.locator('[data-testid="paperx-mode-design"]').click();

      // Wrap is 300x200; child is 100x80 at left:50, top:40. The wrap's
      // top-left corner (10, 10 inside its bbox) sits in dead space
      // outside the child, so clicking there selects the wrap, not the
      // child painted on top of it.
      const wrap = page.locator('[data-uid="dist-wrap-A"]');
      await wrap.click({ position: { x: 10, y: 10 } });

      const child = page.locator('[data-uid="dist-child-B"]');
      await child.hover();

      // 4 inset chips, one per side.
      const chips = page.locator('[data-testid^="paperx-distance-"]');
      await expect(chips).toHaveCount(4, { timeout: 3_000 });
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const chip = page.locator(`[data-testid="paperx-distance-${side}"]`);
        await expect(chip).toBeVisible();
        await expect(chip).toHaveAttribute('data-kind', 'inset');
      }
      // No alignment guides for containment.
      await expect(page.locator('[data-testid="paperx-alignment-guide"]')).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test('Vertical-gap case: 1 outer chip on bottom side, 0 alignment guides', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);
      await page.locator('[data-testid="paperx-mode-design"]').click();

      // vstack-A above vstack-B, same x range → horizontal overlap, no
      // vertical overlap → vertical-gap. Selected = A (top), so the
      // chip lives on A's bottom side.
      await page.locator('[data-uid="dist-vstack-A"]').click();
      await page.locator('[data-uid="dist-vstack-B"]').hover();

      const chips = page.locator('[data-testid^="paperx-distance-"]');
      await expect(chips).toHaveCount(1, { timeout: 3_000 });
      const bottomChip = page.locator('[data-testid="paperx-distance-bottom"]');
      await expect(bottomChip).toBeVisible();
      await expect(bottomChip).toHaveAttribute('data-kind', 'outer');
      await expect(page.locator('[data-testid="paperx-alignment-guide"]')).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test('Diagonal case: 2 outer chips + 2 alignment guides', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);
      await page.locator('[data-testid="paperx-mode-design"]').click();

      // diag-A top-left, diag-B bottom-right, no axis overlap → diagonal.
      // Two chips on A's right (horizontal gap) + bottom (vertical gap)
      // sides, plus two dashed sight-lines.
      await page.locator('[data-uid="dist-diag-A"]').click();
      await page.locator('[data-uid="dist-diag-B"]').hover();

      const chips = page.locator('[data-testid^="paperx-distance-"]');
      await expect(chips).toHaveCount(2, { timeout: 3_000 });
      await expect(page.locator('[data-testid="paperx-distance-right"]')).toBeVisible();
      await expect(page.locator('[data-testid="paperx-distance-bottom"]')).toBeVisible();
      await expect(page.locator('[data-testid="paperx-distance-right"]')).toHaveAttribute(
        'data-kind',
        'outer',
      );
      await expect(page.locator('[data-testid="paperx-distance-bottom"]')).toHaveAttribute(
        'data-kind',
        'outer',
      );
      await expect(page.locator('[data-testid="paperx-alignment-guide"]')).toHaveCount(2);
    } finally {
      await ctx.close();
    }
  });

  test('Guides do not render in transition mode', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);
      await page.locator('[data-testid="paperx-mode-transition"]').click();
      await page.locator('[data-uid="hero-title-001"]').hover();
      await expect(page.locator('[data-testid="paperx-hover-guide-top"]')).toHaveCount(0, {
        timeout: 3_000,
      });
    } finally {
      await ctx.close();
    }
  });
});

/**
 * v0.5.0 — Border multi-row editor + react-color Sketch ColorPicker.
 */
test.describe('paperx Border + ColorPicker (v0.5.0)', () => {
  test('Border: + adds rows up to 4 (max), then disables', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      const addBtn = page.locator('[data-testid="paperx-border-add"]');

      // First click → seeds an "All" row.
      await addBtn.click({ timeout: 10_000 });
      const rows = page.locator('[data-testid^="paperx-border-row-b-"]');
      await expect(rows).toHaveCount(1);

      // With "All" present, + is disabled (mutually exclusive).
      await expect(addBtn).toBeDisabled();

      // Switch the All row to a specific side so we can add more. V2
      // direction is a Radix-Popover Dropdown (not a native <select>),
      // so we open the menu and click the option by per-item testid.
      const firstDirection = page.locator('[data-testid^="paperx-border-b-"][data-testid$="-direction"]').first();
      const directionTestid = await firstDirection.getAttribute('data-testid');
      await firstDirection.click();
      await page.locator(`[data-testid="${directionTestid}-opt-top"]`).click();
      await expect(addBtn).toBeEnabled();

      // Add 3 more to reach 4 per-side rows.
      await addBtn.click();
      await addBtn.click();
      await addBtn.click();
      await expect(rows).toHaveCount(4);

      // At 4 rows, + disabled (no more unique sides left).
      await expect(addBtn).toBeDisabled();
    } finally {
      await ctx.close();
    }
  });

  test('Border: switching to All collapses other rows + writes shorthand', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      const addBtn = page.locator('[data-testid="paperx-border-add"]');
      await addBtn.scrollIntoViewIfNeeded();
      await addBtn.click();
      // First row seeded as All — swap to Top so we can add a second row.
      const rows = page.locator('[data-testid^="paperx-border-row-b-"]');
      const firstDirection = page.locator('[data-testid^="paperx-border-b-"][data-testid$="-direction"]').first();
      const pickSide = async (sideValue: string) => {
        const id = await firstDirection.getAttribute('data-testid');
        await firstDirection.click();
        await page.locator(`[data-testid="${id}-opt-${sideValue}"]`).click();
      };
      await pickSide('top');
      await addBtn.click();
      await expect(rows).toHaveCount(2);

      // Confirm per-side longhands wrote.
      await expect
        .poll(
          async () =>
            target.evaluate((el) => (el as HTMLElement).style.borderTopWidth),
          { timeout: 5_000 },
        )
        .toBe('1px');

      // Flip first row back to All — collapses to single row + shorthand.
      await pickSide('all');
      await expect(rows).toHaveCount(1);

      // Assert the inline-style cssText carries the shorthand and not the
      // per-side longhand declaration. (Reading `style.borderTopWidth`
      // post-shorthand returns the expanded value, so cssText is the
      // ground truth.)
      const cssText = await target.evaluate((el) => el.style.cssText);
      expect(cssText).toContain('border-width');
      expect(cssText).not.toContain('border-top-width');
    } finally {
      await ctx.close();
    }
  });

  test('ColorPicker: clicking the Sketch saturation area picks a non-black color', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      // Spawn a Border row so a ColorPicker swatch is reachable.
      const addBtn = page.locator('[data-testid="paperx-border-add"]');
      await addBtn.click({ timeout: 10_000 });

      // Open the picker for the row's color.
      const swatch = page.locator('[data-testid="paperx-color-trigger"]').first();
      await swatch.click({ timeout: 10_000 });
      const popover = page.locator('[data-testid="paperx-color-popover"]');
      await expect(popover).toBeVisible({ timeout: 5_000 });

      // Locate the saturation area via its react-color class and click
      // in the top-right (high saturation, high value → strong color).
      // This is the exact interaction the user reported as broken.
      const saturationCoords = await page.locator('paperx-root').evaluate((el) => {
        const sh = (el as HTMLElement & { shadowRoot: ShadowRoot | null }).shadowRoot;
        if (!sh) return null;
        const sat = sh.querySelector('.saturation-white');
        if (!sat) return null;
        const r = (sat as HTMLElement).getBoundingClientRect();
        return { x: r.x + r.width * 0.85, y: r.y + r.height * 0.15 };
      });
      expect(saturationCoords).not.toBeNull();
      await page.mouse.click(saturationCoords!.x, saturationCoords!.y);

      // Commit via popover dismiss — v0.10.1 removed the Apply button.
      // The saturation click set draggedRef.current = true (via Sketch's
      // onChangeComplete), so finalizeAndClose commits on close. ESC is
      // Radix Popover's standard dismiss path.
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0, { timeout: 5_000 });

      // Border color must have moved away from the default black.
      const finalColor = await target.evaluate(
        (el) =>
          (el as HTMLElement).style.borderColor ||
          (el as HTMLElement).style.borderTopColor ||
          '',
      );
      expect(finalColor).not.toBe('');
      expect(finalColor.toLowerCase()).not.toContain('rgb(0,0,0)');
      expect(finalColor.toLowerCase()).not.toMatch(/#000000(ff)?/);
    } finally {
      await ctx.close();
    }
  });

  // Removed in v0.6.0: 'Border: collapse + re-expand restores rows from
  // inline style' — pre-MVP design-panel sections are always-on (no
  // collapse), so the scenario this test covered no longer exists.

  test('Border: switching the selected element re-seeds the entries', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();

      // First element: add a Border row so inline style is non-empty.
      await page.locator('[data-uid="cta-btn-003"]').click();
      await page.locator('[data-testid="paperx-border-add"]').click({ timeout: 10_000 });
      const rows = page.locator('[data-testid^="paperx-border-row-b-"]');
      await expect(rows).toHaveCount(1);

      // Switch to a second element which has no inline border.
      await page.locator('[data-uid="hero-title-001"]').click();
      await expect(rows).toHaveCount(0, { timeout: 5_000 });

      // Switch back: entries must reappear from inline style.
      await page.locator('[data-uid="cta-btn-003"]').click();
      await expect(rows).toHaveCount(1, { timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  // v0.10.3 regression guard. v0.10.2 introduced --dv-bg-popover: #2c2c2e
  // but the var was defined under [data-theme="dark"] on #paperx-react-root
  // — Radix popovers portal to #paperx-portal-layer (SIBLING of react-root)
  // so the var was out of scope and the menu rendered transparent. v0.10.3
  // hoists the dark tokens onto :host so they cascade everywhere in the
  // shadow tree. This test asserts the computed background of an opened
  // dropdown menu is rgb(44, 44, 46) — proof the cascade lands.
  test('Border: design-v2 dropdown menu renders with opaque #2c2c2e bg (v0.10.3)', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      await page.locator('[data-uid="cta-btn-003"]').click();
      await page.locator('[data-testid="paperx-border-add"]').click({ timeout: 10_000 });

      // Open the direction dropdown so the .dv-dropdown-menu mounts in the
      // portal layer.
      const directionTrigger = page
        .locator('[data-testid^="paperx-border-b-"][data-testid$="-direction"]')
        .first();
      await directionTrigger.click();

      // Pull the computed backgroundColor out of the menu element inside
      // the shadow root. CSS computed colors are returned in rgb()/rgba().
      const menuBg = await page.locator('paperx-root').evaluate((host) => {
        const sh = (host as HTMLElement & { shadowRoot: ShadowRoot | null }).shadowRoot;
        if (!sh) return null;
        const menu = sh.querySelector('.dv-dropdown-menu');
        if (!menu) return null;
        return getComputedStyle(menu as Element).backgroundColor;
      });
      // #2c2c2e === rgb(44, 44, 46). Opaque popover means α=1, so the
      // computed value is rgb(...), not rgba(...) with alpha.
      expect(menuBg).toBe('rgb(44, 44, 46)');

      // Trigger should report the open data-state and the computed
      // background should be the gold-tinted active token (resolves to
      // rgba(255,255,255,0.14)).
      await expect(directionTrigger).toHaveAttribute('data-state', 'open');
    } finally {
      await ctx.close();
    }
  });
});

/**
 * Smoke coverage for the design-v2 inspector that replaces the V1
 * DesignPanel. Verifies (1) the panel mounts on selection, (2) the
 * Design/Inspect sub-tabs both render, and (3) editing Frame.W commits
 * an inline `width` and surfaces a ChangeLog row — the same single-
 * writer path the retired V1 BoxModel test exercised.
 */
test.describe('paperx design-v2 ruler mode', () => {
  test('design-v2: ruler mode renders the V2 Inspect view (BoxModel + CodeBlock), no sub-tab strip', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-ruler"]').click();
      await page.locator('[data-uid="cta-btn-003"]').click();

      const panel = page.locator('[data-testid="paperx-v2-panel"]');
      await expect(panel).toBeVisible({ timeout: 5_000 });
      // In ruler mode the panel exposes data-mode="ruler" so the
      // sub-tab strip is suppressed; no Design / Inspect buttons.
      await expect(panel).toHaveAttribute('data-mode', 'ruler');
      await expect(page.locator('[data-testid="paperx-v2-subtab-design"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="paperx-v2-subtab-inspect"]')).toHaveCount(0);

      // Inspect content (BoxModel + CodeBlock) is rendered directly.
      await expect(page.locator('[data-testid="paperx-v2-box-model"]')).toBeVisible();
      await expect(page.locator('[data-testid="paperx-v2-code-block"]')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

test.describe('paperx design-v2 inspector', () => {
  test('design-v2: panel mounts with Design + Inspect sub-tabs and Frame.W commits a width edit', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      // Panel mounts on selection.
      const panel = page.locator('[data-testid="paperx-v2-panel"]');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      // Both sub-tabs render; Design is the default.
      const designTab = page.locator('[data-testid="paperx-v2-subtab-design"]');
      const inspectTab = page.locator('[data-testid="paperx-v2-subtab-inspect"]');
      await expect(designTab).toBeVisible();
      await expect(inspectTab).toBeVisible();
      await expect(page.locator('[data-testid="paperx-v2-content-design"]')).toBeVisible();

      // Edit Frame.W → host width updates + ChangeLog row appears.
      const wField = page.locator('[data-testid="paperx-v2-frame-w"]');
      await expect(wField).toBeVisible();
      const wInput = wField.locator('input');
      await wInput.fill('256');
      await wInput.blur();
      await expect
        .poll(
          async () => target.evaluate((el) => (el as HTMLElement).style.width),
          { timeout: 5_000 },
        )
        .toBe('256px');

      // Switching to Inspect renders the box-model + code block.
      await inspectTab.click();
      await expect(page.locator('[data-testid="paperx-v2-box-model"]')).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.locator('[data-testid="paperx-v2-code-block"]')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

/**
 * v0.11.0 — draggable FloatingToolbar + auto-positioned DesignPanel.
 *
 * Toolbar drag: grip handle on the leftmost slot of the pill. pointerdown
 * captures, pointermove updates uiStore.toolbarPosition (sessionStorage
 * persisted per tab), pointerup releases.
 *
 * Auto-position: DesignPanelV2 reads selectionStore.selectedRect via
 * pickPanelPosition and picks the first of {right, left, below, above}
 * placements that fits the viewport + clears the toolbar + clears the
 * selected element bbox + handle padding.
 */
test.describe('paperx draggable toolbar (v0.11.0)', () => {
  test('Drag handle moves the toolbar; sessionStorage survives a reload', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      const toolbar = page.locator('[data-testid="paperx-toolbar"]');
      const grip = page.locator('[data-testid="paperx-toolbar-drag"]');
      await expect(toolbar).toBeVisible();
      await expect(grip).toBeVisible();

      const before = await toolbar.boundingBox();
      expect(before).not.toBeNull();

      // Manual pointer dance — Playwright's drag helpers expect a real
      // HTML5 DnD source. We're using pointer events so simulate them.
      const gripBox = await grip.boundingBox();
      expect(gripBox).not.toBeNull();
      const startX = gripBox!.x + gripBox!.width / 2;
      const startY = gripBox!.y + gripBox!.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - 200, startY + 100, { steps: 4 });
      await page.mouse.move(startX - 200, startY + 100);
      await page.mouse.up();

      // Toolbar parked at the new location.
      await expect
        .poll(async () => (await toolbar.boundingBox())?.x ?? -1, { timeout: 3_000 })
        .toBeLessThan(before!.x - 100);
      const afterDrag = await toolbar.boundingBox();
      expect(afterDrag!.y).toBeGreaterThan(before!.y + 50);

      // Persistence: sessionStorage entry survives an in-tab reload.
      await page.reload();
      const toolbarAfterReload = page.locator('[data-testid="paperx-toolbar"]');
      await expect(toolbarAfterReload).toBeVisible({ timeout: 5_000 });
      const afterReload = await toolbarAfterReload.boundingBox();
      expect(afterReload).not.toBeNull();
      // Position survived (within ~4 px due to layout rounding).
      expect(Math.abs(afterReload!.x - afterDrag!.x)).toBeLessThan(4);
      expect(Math.abs(afterReload!.y - afterDrag!.y)).toBeLessThan(4);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('paperx design panel auto-position (v0.11.0)', () => {
  test('Panel parks to the right of the selected element with handle clearance', async () => {
    const ctx = await launchWithExtension();
    try {
      const page = await openFixture(ctx);

      await page.locator('[data-testid="paperx-mode-design"]').click();

      // cta-btn-003 lives in the top-left of the fixture body. The panel
      // should land to its right with a visible gap, NOT overlap it, and
      // NOT overlap the floating toolbar.
      const target = page.locator('[data-uid="cta-btn-003"]');
      await target.click();

      const panel = page.locator('[data-testid="paperx-v2-panel"]');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      const targetBox = await target.boundingBox();
      const panelBox = await panel.boundingBox();
      expect(targetBox).not.toBeNull();
      expect(panelBox).not.toBeNull();

      // Panel.left > target.right + handle clearance (gap+handlePad = 24).
      expect(panelBox!.x).toBeGreaterThan(targetBox!.x + targetBox!.width + 16);

      // Panel does NOT overlap the toolbar.
      const toolbarBox = await page
        .locator('[data-testid="paperx-toolbar"]')
        .boundingBox();
      expect(toolbarBox).not.toBeNull();
      const overlapsToolbar =
        panelBox!.x < toolbarBox!.x + toolbarBox!.width &&
        panelBox!.x + panelBox!.width > toolbarBox!.x &&
        panelBox!.y < toolbarBox!.y + toolbarBox!.height &&
        panelBox!.y + panelBox!.height > toolbarBox!.y;
      expect(overlapsToolbar).toBe(false);

      // And it does NOT overlap the selected element itself.
      const overlapsTarget =
        panelBox!.x < targetBox!.x + targetBox!.width &&
        panelBox!.x + panelBox!.width > targetBox!.x &&
        panelBox!.y < targetBox!.y + targetBox!.height &&
        panelBox!.y + panelBox!.height > targetBox!.y;
      expect(overlapsTarget).toBe(false);
    } finally {
      await ctx.close();
    }
  });
});
