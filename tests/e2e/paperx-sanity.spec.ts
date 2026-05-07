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

async function openFixture(ctx: BrowserContext): Promise<Page> {
  // Persistent context spawns with a default about:blank tab; reuse it
  // when present, otherwise open a new one.
  const existing = ctx.pages()[0];
  const page = existing ?? (await ctx.newPage());
  await page.goto(FIXTURE_URL);
  // Wait for paperx-root to be appended by the content script.
  // Bootstrap defaults to visible:true so the toolbar should pop up
  // shortly after document_idle.
  await page.locator('paperx-root').waitFor({ state: 'attached', timeout: 10_000 });
  await page.locator('[data-testid="paperx-toolbar"]').waitFor({ timeout: 10_000 });
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
      for (const m of ['design', 'ruler', 'comment', 'layout'] as const) {
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

  test('design mode picker selects element and DesignPanel reflects size', async () => {
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

  test('edit font-size + ChangeLog records it + Export Prompt copies v1 JSON', async () => {
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
      // The header's Export Prompt button calls
      // exporter.copyToClipboard(undefined, portal); the truthy
      // fallbackHost arg routes through the legacy markdown-fenced
      // path, so the clipboard contains:
      //   # paperx prompt (paperx-prompt-v1)
      //   # generated ... for ...
      //   # N change(s) across M target(s) ...
      //
      //   ```json
      //   { ...prompt v1... }
      //   ```
      // We assert on both the schema string substring (cheap proof
      // of identity) and the parsed JSON inside the fence (deep
      // proof we can round-trip).
      expect(clipboardText).toContain('"schema": "paperx-prompt-v1"');
      const fenceMatch = clipboardText.match(/```json\n([\s\S]*?)\n```/);
      expect(fenceMatch).not.toBeNull();
      const parsed = JSON.parse(fenceMatch![1]!);
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
});
