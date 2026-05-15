/**
 * Per-tab ChangeLog count bridge — mirrors `enabled.ts`'s session-cache
 * + broadcast shape so the popup can paint a live count without a SW
 * round trip, and the SW can paint the action badge.
 *
 * Flow:
 *   - Content script: `reportCount(n)` whenever ChangeLog total moves
 *     (message; SW resolves `sender.tab.id`). The SW writes
 *     `paperx_count_${tabId}` to session, sets the action badge, and
 *     rebroadcasts PAPERX_COUNT_CHANGED.
 *   - Popup: `readCountFromSession(tabId)` for instant first paint,
 *     `onCountChange(cb)` to stay live while open.
 */
import {
  PAPERX_COUNT_CHANGED,
  PAPERX_REPORT_COUNT,
  type PaperxMessage,
} from '@/shared/types/messages';

const SESSION_KEY_PREFIX = 'paperx_count_';
export const countKeyFor = (tabId: number): string =>
  `${SESSION_KEY_PREFIX}${tabId}`;

/** Fast direct read (popup / SW context). Falls back to 0 on error. */
export async function readCountFromSession(tabId: number): Promise<number> {
  try {
    const k = countKeyFor(tabId);
    const r = await chrome.storage.session.get(k);
    const n = r[k];
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Content-script push. SW infers the tab from `sender.tab.id`. */
export async function reportCount(count: number): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: PAPERX_REPORT_COUNT,
      count,
    } satisfies PaperxMessage);
  } catch {
    // SW asleep / tab gone — the next reaction tick retries.
  }
}

/** Popup subscription to SW count rebroadcasts. Returns unsubscribe. */
export function onCountChange(cb: (count: number) => void): () => void {
  const handler = (msg: PaperxMessage): void => {
    if (msg?.type === PAPERX_COUNT_CHANGED) cb(msg.count);
  };
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}
