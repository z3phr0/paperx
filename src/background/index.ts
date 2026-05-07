/**
 * paperx — background service worker (MV3)
 *
 * Phase 1 responsibilities:
 *   1. Forward action click → content script "PAPERX_TOGGLE" message
 *   2. Forward keyboard command (_execute_action) is handled by Chrome itself,
 *      which fires onClicked when no popup is set.
 *
 * Phase 2+ will own:
 *   - Cross-tab change-log sync via chrome.storage.session
 *   - JSON Prompt export pipeline
 */

const TOGGLE_MSG = 'PAPERX_TOGGLE' as const;

chrome.runtime.onInstalled.addListener(() => {
  console.info('[paperx/bg] installed');
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: TOGGLE_MSG });
  } catch (err) {
    // Content script may not be injected on chrome:// pages, etc.
    console.warn('[paperx/bg] sendMessage failed', err);
  }
});

export {};
