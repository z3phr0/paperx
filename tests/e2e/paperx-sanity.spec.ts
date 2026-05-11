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

  test('ruler mode renders read-only measurements for the selected element', async () => {
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

      // ChangeLog drawer should now carry both width and height rows.
      await page.locator('[data-testid="paperx-history"]').click();
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

      // Mode-agnostic: don't switch modes, just hover. Picker is active
      // whenever paperx is visible.
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
  test('BoxModel: editing W writes inline width and surfaces a ChangeLog row', async () => {
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

  test('BoxModel: padding link toggle broadcasts to all 4 sides', async () => {
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

      await page.locator('[data-testid="paperx-history"]').click();
      const rows = page.locator('paperx-root [role="row"]');
      await expect(rows.first()).toBeVisible({ timeout: 5_000 });
      const rowsText = await rows.allInnerTexts();
      expect(rowsText.some((t) => t.includes('transition-timing-function'))).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  test('Background: switching to gradient type surfaces the gradient editor', async () => {
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

      // Unified mode is the default — typing into the unified input
      // applies the same value to all 4 corners.
      const unifiedInput = page.locator('[data-testid="paperx-radius-unified-input"]');
      await expect(unifiedInput).toBeVisible({ timeout: 5_000 });
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

      // Filling only TL must NOT broadcast to other corners.
      const tl = page.locator('[data-testid="paperx-radius-tl"]');
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
        .toEqual(['20px', '']);
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

      // Open ChangeLog drawer, export prompt, parse clipboard JSON.
      await page.locator('[data-testid="paperx-history"]').click();
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
 * v0.2.4 — Popup global ON/OFF switch.
 */
test.describe('paperx popup (v0.2.4)', () => {
  test('Popup loads with ON state and the big toggle disables the content script', async () => {
    const ctx = await launchWithExtension();
    try {
      // Open a fixture tab first to confirm the toolbar mounts by default.
      const fixture = await openFixture(ctx);
      await expect(fixture.locator('[data-testid="paperx-toolbar"]')).toBeVisible({
        timeout: 10_000,
      });

      // Resolve the extension id via the MV3 service worker URL.
      const sw =
        ctx.serviceWorkers()[0] ??
        (await ctx.waitForEvent('serviceworker', { timeout: 10_000 }));
      const extId = new URL(sw.url()).host;

      // Open the popup HTML in a separate page (Chrome doesn't render the
      // real action popup in headless contexts; navigating directly to
      // the bundled HTML is the canonical playwright workaround).
      const popup = await ctx.newPage();
      await popup.goto(`chrome-extension://${extId}/src/popup/index.html`);

      const toggle = popup.locator('[data-testid="paperx-popup-toggle"]');
      await expect(toggle).toBeVisible({ timeout: 5_000 });
      await expect(toggle).toHaveText('ON');

      // Flip to OFF — the storage write should propagate to the content
      // script in the other tab and tear paperx-root down entirely.
      await toggle.click();
      await expect(toggle).toHaveText('OFF');
      await expect(fixture.locator('paperx-root')).toHaveCount(0, { timeout: 5_000 });

      // Flip back to ON — paperx-root re-mounts.
      await toggle.click();
      await expect(toggle).toHaveText('ON');
      await expect(fixture.locator('paperx-root')).toHaveCount(1, { timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });
});
