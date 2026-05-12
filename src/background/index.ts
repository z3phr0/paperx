/**
 * paperx — background service worker (MV3)
 *
 * Owns per-tab `enabled` state in an in-memory `Map<tabId, boolean>`.
 * Default is OFF (missing entry -> false). Cleared per-tab on close.
 *
 * Message handlers:
 *   - PAPERX_QUERY_ENABLED   -> returns { enabled } for sender's tab (or
 *                                  explicit tabId from popup)
 *   - PAPERX_SET_ENABLED     -> set + broadcast PAPERX_ENABLED_CHANGED
 *   - PAPERX_TOGGLE_ENABLED  -> flip + broadcast
 *
 * Keyboard command:
 *   - `toggle-paperx` (Cmd+Shift+P / Ctrl+Shift+P) — flips the active
 *     tab's enabled state directly. The popup is no longer the only
 *     entry point for toggling.
 *
 * Known limitation: MV3 SWs sleep after ~30s of inactivity; on next
 * wake, `enabledByTab` is empty (every tab reads OFF). Acceptable
 * trade-off for the simpler in-memory model. Upgrade to
 * `chrome.storage.session` if SW dormancy becomes a UX issue.
 */
import {
  PAPERX_ENABLED_CHANGED,
  PAPERX_QUERY_ENABLED,
  PAPERX_SET_ENABLED,
  PAPERX_TOGGLE_ENABLED,
  type PaperxMessage,
} from '@/shared/types/messages';

const enabledByTab = new Map<number, boolean>();

function setTabEnabled(tabId: number, value: boolean): void {
  enabledByTab.set(tabId, value);
  // Notify the affected tab's content script. Failure is fine: the
  // content script may not be injected (chrome:// page, file:// blocked, etc).
  chrome.tabs
    .sendMessage(tabId, {
      type: PAPERX_ENABLED_CHANGED,
      enabled: value,
    } satisfies PaperxMessage)
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  console.info('[paperx/bg] installed');
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enabledByTab.delete(tabId);
});

chrome.runtime.onMessage.addListener(
  (msg: PaperxMessage, sender, sendResponse) => {
    if (msg?.type === PAPERX_QUERY_ENABLED) {
      const tabId = msg.tabId ?? sender.tab?.id;
      if (tabId == null) {
        sendResponse({ enabled: false });
        return;
      }
      sendResponse({ enabled: enabledByTab.get(tabId) ?? false });
      return;
    }
    if (msg?.type === PAPERX_SET_ENABLED) {
      setTabEnabled(msg.tabId, msg.value);
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === PAPERX_TOGGLE_ENABLED) {
      const cur = enabledByTab.get(msg.tabId) ?? false;
      const next = !cur;
      setTabEnabled(msg.tabId, next);
      sendResponse({ enabled: next });
      return;
    }
  },
);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-paperx') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const cur = enabledByTab.get(tab.id) ?? false;
  setTabEnabled(tab.id, !cur);
});

export {};
