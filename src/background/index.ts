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

// v0.14.2 badge palette. active → the tab's ChangeLog count on a
// light-green chip (dark-green text for small-glyph contrast); paused
// → a pause glyph on neutral gray so a disabled tab reads as "off"
// rather than just blank.
const ACTIVE_BG = '#86EFAC'; // Tailwind green-300 (light green)
const ACTIVE_TEXT = '#14532D'; // dark green — high contrast on the chip
const PAUSED_BG = '#6B7280'; // neutral gray
const PAUSED_TEXT = '#FFFFFF';
// U+2016 DOUBLE VERTICAL LINE — universally present in badge fonts and
// monochrome (unlike U+23F8 ⏸ which can render as a color emoji).
const PAUSE_GLYPH = '‖';

function actionTitle(enabled: boolean, count: number): string {
  if (!enabled) return 'PaperX — paused on this tab';
  if (count > 0) {
    return `PaperX — active · ${count} ${count === 1 ? 'change' : 'changes'}`;
  }
  return 'PaperX — active on this tab';
}

// v0.14.3: Chrome renders the native `setBadgeText` badge itself with
// no alignment/position control — single-glyph counts read optically
// off-center. The only way to pixel-place the count on the toolbar
// icon is to composite the icon ourselves and feed it to setIcon. The
// SW decodes the brand icon once, then per (enabled,count) draws a
// bottom-right chip with the label perfectly centered.
const ICON_SIZES = [16, 32, 48] as const;

let baseBitmapPromise: Promise<ImageBitmap> | null = null;
function loadBaseIcon(): Promise<ImageBitmap> {
  if (!baseBitmapPromise) {
    baseBitmapPromise = fetch(chrome.runtime.getURL('src/assets/icon.png'))
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b));
  }
  return baseBitmapPromise;
}

async function composeIcon(
  enabled: boolean,
  count: number,
): Promise<Record<number, ImageData>> {
  const base = await loadBaseIcon();
  const label = enabled ? String(count) : PAUSE_GLYPH;
  const chipBg = enabled ? ACTIVE_BG : PAUSED_BG;
  const chipFg = enabled ? ACTIVE_TEXT : PAUSED_TEXT;
  const out: Record<number, ImageData> = {};
  for (const s of ICON_SIZES) {
    const cv = new OffscreenCanvas(s, s);
    const ctx = cv.getContext('2d');
    if (!ctx) continue;
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(base, 0, 0, s, s);
    // Chip hugs the bottom-right corner.
    const d = Math.round(s * 0.62);
    const inset = Math.round(s * 0.04);
    const cx = s - d / 2 - inset;
    const cy = s - d / 2 - inset;
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.fillStyle = chipBg;
    ctx.fill();
    // 16px is too small for legible text — color chip only conveys
    // the state there; 32/48 carry the centered glyph.
    if (s >= 32) {
      ctx.fillStyle = chipFg;
      ctx.font = `700 ${Math.round(d * 0.62)}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Tiny optical nudge — middle baseline + a hair down reads as
      // truly centered for digits at this size.
      ctx.fillText(label, cx, cy + Math.round(s * 0.02));
    }
    out[s] = ctx.getImageData(0, 0, s, s);
  }
  return out;
}

async function readCount(tabId: number): Promise<number> {
  try {
    const k = countKeyFor(tabId);
    const r = await chrome.storage.session.get(k);
    const n = r[k];
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Single writer for the toolbar action's per-tab visual state. Renders
 * (enabled, count) into the badge + tooltip so paused / active-idle /
 * active-with-changes are all distinguishable on the toolbar icon
 * itself — MV3 can't restyle the raster icon, so badge + title are the
 * state channel. Still caches the count in session + rebroadcasts so
 * an open popup mirrors live. Every chrome.* call is best-effort: a
 * closed tab or dormant SW must never throw.
 */
async function applyActionState(
  tabId: number,
  enabled: boolean,
  count: number,
): Promise<void> {
  try {
    await chrome.storage.session.set({ [countKeyFor(tabId)]: count });
  } catch (err) {
    console.warn('[paperx/bg] count session.set failed', err);
  }
  // Clear any stale native badge — the count now lives in the
  // composited icon, a doubled-up badge would be noise.
  chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  // Composite + apply the icon. On any failure (fetch / OffscreenCanvas
  // unsupported) we keep whatever icon was last set and still surface
  // state through the title — never throw.
  void composeIcon(enabled, count)
    .then((imageData) => chrome.action.setIcon({ tabId, imageData }))
    .catch((err) =>
      console.warn('[paperx/bg] setIcon compose failed', err),
    );
  chrome.action
    .setTitle({ tabId, title: actionTitle(enabled, count) })
    .catch(() => {});
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
  // Always repaint the action so the toolbar reflects the new state:
  //   - disabled → empty badge + "paused" title (count forced to 0;
  //     the content script is torn down so its last count is stale)
  //   - enabled  → ● badge + "active" title (count starts at 0; the
  //     content script's reaction fireImmediately re-reports the real
  //     count a beat later and re-renders the number)
  const count = value ? await readCount(tabId) : 0;
  void applyActionState(tabId, value, count);
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
      if (tabId != null) {
        // Gate the count on current enabled state — a REPORT racing a
        // just-disabled tab must not flash a number onto a paused icon.
        void getTabEnabled(tabId).then((enabled) =>
          applyActionState(tabId, enabled, msg.count),
        );
      }
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
