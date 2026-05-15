/**
 * paperx — background service worker (MV3)
 *
 * Owns per-tab `enabled` state in `chrome.storage.session` (keyed by
 * `paperx_tab_${tabId}`). Session storage is browser-process-local,
 * survives SW dormancy, and clears on browser quit — exactly the
 * lifecycle paperx wants. Default OFF for every newly opened tab.
 *
 * Why session over an in-memory Map (v0.7.0 design): the popup needs
 * to read state on a click reaction. Going through a SW message wakes
 * a dormant SW (50-300ms cost). Session storage reads are local IPC
 * (~5ms) — popup can read directly with no SW round trip.
 *
 * Message handlers (still SW-mediated for writes + content-script reads):
 *   - PAPERX_QUERY_ENABLED   -> { enabled } for sender's tab (or
 *                                  explicit tabId from popup)
 *   - PAPERX_SET_ENABLED     -> set + broadcast PAPERX_ENABLED_CHANGED
 *   - PAPERX_TOGGLE_ENABLED  -> flip + broadcast
 *
 * Keyboard command:
 *   - `toggle-paperx` (Cmd+Shift+P / Ctrl+Shift+P) — flips the active
 *     tab's enabled state directly.
 */
import {
  PAPERX_COUNT_CHANGED,
  PAPERX_ENABLED_CHANGED,
  PAPERX_QUERY_ENABLED,
  PAPERX_REPORT_COUNT,
  PAPERX_SET_ENABLED,
  PAPERX_TOGGLE_ENABLED,
  type PaperxMessage,
} from '@/shared/types/messages';
import { countKeyFor } from '@/shared/storage/changeCount';

const SESSION_KEY_PREFIX = 'paperx_tab_';
const keyFor = (tabId: number): string => `${SESSION_KEY_PREFIX}${tabId}`;

const BADGE_COLOR = '#D09A06';

/**
 * Cache the tab's ChangeLog count in session (popup reads it direct),
 * paint the toolbar action badge, and rebroadcast so an open popup
 * mirrors it live. Every chrome.* call is best-effort — a closed tab
 * or asleep SW must not throw.
 */
async function applyCount(tabId: number, count: number): Promise<void> {
  try {
    await chrome.storage.session.set({ [countKeyFor(tabId)]: count });
  } catch (err) {
    console.warn('[paperx/bg] count session.set failed', err);
  }
  const text = count > 0 ? String(count) : '';
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (count > 0) {
    chrome.action
      .setBadgeBackgroundColor({ tabId, color: BADGE_COLOR })
      .catch(() => {});
  }
  chrome.tabs
    .sendMessage(tabId, {
      type: PAPERX_COUNT_CHANGED,
      count,
    } satisfies PaperxMessage)
    .catch(() => {});
}

async function getTabEnabled(tabId: number): Promise<boolean> {
  try {
    const k = keyFor(tabId);
    const r = await chrome.storage.session.get(k);
    return r[k] === true;
  } catch {
    return false;
  }
}

async function setTabEnabled(tabId: number, value: boolean): Promise<void> {
  try {
    await chrome.storage.session.set({ [keyFor(tabId)]: value });
  } catch (err) {
    console.warn('[paperx/bg] storage.session.set failed', err);
  }
  // Notify the affected tab's content script. Failure is fine: the
  // content script may not be injected (chrome:// page, file:// blocked, etc).
  chrome.tabs
    .sendMessage(tabId, {
      type: PAPERX_ENABLED_CHANGED,
      enabled: value,
    } satisfies PaperxMessage)
    .catch(() => {});
  // Disabling the tab tears the content script down, so its count is
  // now meaningless — clear the badge + cache immediately rather than
  // waiting for the (never-arriving) reportCount(0) from a dead frame.
  if (!value) void applyCount(tabId, 0);
}

chrome.runtime.onInstalled.addListener(() => {
  console.info('[paperx/bg] installed');
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(keyFor(tabId)).catch(() => {});
  void chrome.storage.session.remove(countKeyFor(tabId)).catch(() => {});
});

chrome.runtime.onMessage.addListener(
  (msg: PaperxMessage, sender, sendResponse) => {
    if (msg?.type === PAPERX_QUERY_ENABLED) {
      const tabId = msg.tabId ?? sender.tab?.id;
      if (tabId == null) {
        sendResponse({ enabled: false });
        return true;
      }
      void getTabEnabled(tabId).then((enabled) => sendResponse({ enabled }));
      return true; // async response
    }
    if (msg?.type === PAPERX_SET_ENABLED) {
      void setTabEnabled(msg.tabId, msg.value).then(() => sendResponse({ ok: true }));
      return true;
    }
    if (msg?.type === PAPERX_TOGGLE_ENABLED) {
      void (async () => {
        const cur = await getTabEnabled(msg.tabId);
        const next = !cur;
        await setTabEnabled(msg.tabId, next);
        sendResponse({ enabled: next });
      })();
      return true;
    }
    if (msg?.type === PAPERX_REPORT_COUNT) {
      const tabId = sender.tab?.id;
      if (tabId != null) void applyCount(tabId, msg.count);
      // Fire-and-forget — the content script doesn't await a response.
      return;
    }
  },
);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-paperx') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const cur = await getTabEnabled(tab.id);
  await setTabEnabled(tab.id, !cur);
});

// E2E hook: expose setTabEnabled on globalThis so Playwright can drive
// per-tab state via `worker.evaluate`. Now async (awaits session write).
declare global {
  // eslint-disable-next-line no-var
  var __paperxSetTabEnabled: ((tabId: number, value: boolean) => Promise<void>) | undefined;
}
globalThis.__paperxSetTabEnabled = setTabEnabled;

export {};
