/**
 * Per-tab enabled state — message-based helpers backed by the SW's
 * `chrome.storage.session` store (keyed by `paperx_tab_${tabId}`).
 * Default OFF for every new tab; SW clears the entry on
 * `chrome.tabs.onRemoved`. Session storage survives SW dormancy and
 * clears on browser quit.
 *
 * Read paths:
 *   - Popup: `readTabEnabledFromSession(tabId)` — direct local read,
 *     no SW round trip. Used to keep popup-open latency under 30ms
 *     even when the SW is dormant.
 *   - Content script: `requestTabEnabled()` — message-based (content
 *     scripts cannot reach `chrome.storage.session`; SW resolves via
 *     `sender.tab.id`). The wake cost is amortized into page load.
 *
 * Write paths (always go through SW so it can broadcast
 * PAPERX_ENABLED_CHANGED to the affected tab in the same step):
 *   - `requestSetTabEnabled(tabId, value)`
 *   - `requestToggleTabEnabled(tabId)`
 *
 * Subscribe:
 *   - `onTabEnabledChange(cb)` — listens for `PAPERX_ENABLED_CHANGED`.
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

const SESSION_KEY_PREFIX = 'paperx_tab_';
const sessionKeyFor = (tabId: number): string => `${SESSION_KEY_PREFIX}${tabId}`;

/**
 * Direct, fast read from `chrome.storage.session`. Use from popup /
 * SW / options where the API is available; content scripts must
 * fall back to `requestTabEnabled` (SW message). Falls through to
 * `false` on any error so the caller is always safe to render.
 */
export async function readTabEnabledFromSession(tabId: number): Promise<boolean> {
  try {
    const k = sessionKeyFor(tabId);
    const r = await chrome.storage.session.get(k);
    return r[k] === true;
  } catch {
    return false;
  }
}

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
