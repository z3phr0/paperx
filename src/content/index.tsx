/**
 * paperx — content script entry point (Phase 1 placeholder)
 *
 * Owned by T3 Sprint 2: this file will be rewritten to:
 *   - Bootstrap a Shadow DOM root attached to <html>
 *   - Mount the React UI tree (FloatingToolbar) inside the shadow root
 *   - Wire UIStore.toggle() to background's PAPERX_TOGGLE message
 *
 * For now we just announce presence so we can confirm the manifest /
 * content_scripts wiring works after `bun run build`.
 */
console.info('[paperx/content] loaded — awaiting Shadow DOM bootstrap (T3)');
export {};
