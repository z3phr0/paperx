/**
 * Per-tab enabled state — message-based helpers backed by the SW's
 * in-memory `Map<tabId, boolean>`. Default OFF for every new tab; SW
 * clears the entry on `chrome.tabs.onRemoved`. State is volatile across
 * SW dormancy (~30s idle): if the SW restarts, all tabs go back to OFF.
 *
 * Three call sites:
 *   - Content script: `requestTabEnabled()` on init (sender.tab supplies
 *     the tabId), then `onTabEnabledChange(cb)` for SW broadcasts.
 *   - Popup: `requestTabEnabled(tabId)` / `requestToggleTabEnabled(tabId)`
 *     after `chrome.tabs.query` — popup is in extension context so it
 *     must pass tabId explicitly.
 *   - SW (background): owns the source of truth in `enabledByTab`.
 */
import {
  PAPERX_ENABLED_CHANGED,
  PAPERX_QUERY_ENABLED,
  PAPERX_SET_ENABLED,
  PAPERX_TOGGLE_ENABLED,
  type PaperxMessage,
} from '@/shared/types/messages';

interface QueryResp { enabled: boolean }
interface ToggleResp { enabled: boolean }

/**
 * Ask the SW for the current tab's enabled state. When called from the
 * content script, the SW reads `sender.tab.id` automatically. When
 * called from the popup, pass the active tab id explicitly.
 */
export async function requestTabEnabled(tabId?: number): Promise<boolean> {
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: PAPERX_QUERY_ENABLED,
      tabId,
    } satisfies PaperxMessage)) as QueryResp | undefined;
    return resp?.enabled ?? false;
  } catch {
    return false;
  }
}

export async function requestSetTabEnabled(tabId: number, value: boolean): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: PAPERX_SET_ENABLED,
      tabId,
      value,
    } satisfies PaperxMessage);
  } catch {
    // SW unreachable — caller can retry; nothing to gracefully fall back to.
  }
}

export async function requestToggleTabEnabled(tabId: number): Promise<boolean> {
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: PAPERX_TOGGLE_ENABLED,
      tabId,
    } satisfies PaperxMessage)) as ToggleResp | undefined;
    return resp?.enabled ?? false;
  } catch {
    return false;
  }
}

/**
 * Subscribe to SW broadcasts for this tab's enabled state. Returns an
 * unsubscribe function. The SW only sends `PAPERX_ENABLED_CHANGED` to
 * the affected tab, so the callback fires for state flips that target
 * "this" tab only.
 */
export function onTabEnabledChange(cb: (enabled: boolean) => void): () => void {
  const handler = (msg: PaperxMessage) => {
    if (msg?.type === PAPERX_ENABLED_CHANGED) {
      cb(msg.enabled);
    }
  };
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}
