/**
 * paperx Playwright config — Sprint 3 / S3-A sanity harness.
 *
 * Goal: load the built MV3 extension into a real Chromium and run a
 * tiny set of end-to-end smoke tests. Not a full QA matrix.
 *
 * Notes:
 *   - We rely on `chromium.launchPersistentContext` inside each spec
 *     because MV3 extensions can only be installed via the
 *     --load-extension flag, which Playwright's default browser
 *     fixture cannot pass. So we don't configure `projects`/`use`
 *     beyond shared defaults.
 *   - Tracing kept on first retry only; with `retries: 0` it never
 *     fires unless the spec author overrides — that's intentional,
 *     a sanity suite shouldn't generate artefacts on every run.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
