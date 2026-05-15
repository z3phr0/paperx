/**
 * Global user preferences backed by `chrome.storage.local` (NOT
 * session — these survive browser restarts, unlike per-tab enabled
 * state).
 *
 * Currently just the default tool mode the content script enters when
 * paperx activates on a tab. The popup's mode picker writes it; the
 * content script reads it once in `startMounted()`.
 */
import type { ToolMode } from '@/shared/types/modes';

const DEFAULT_MODE_KEY = 'paperx_default_mode';

/** Modes the popup picker exposes. `transition` is intentionally not a
 *  default-mode candidate — it's a niche panel, not a primary context. */
export const DEFAULT_MODE_CHOICES: ReadonlyArray<
  Extract<ToolMode, 'design' | 'ruler' | 'comment'>
> = ['design', 'ruler', 'comment'];

const FALLBACK: ToolMode = 'design';

function coerce(v: unknown): ToolMode {
  return DEFAULT_MODE_CHOICES.includes(v as never) ? (v as ToolMode) : FALLBACK;
}

export async function getDefaultMode(): Promise<ToolMode> {
  try {
    const r = await chrome.storage.local.get(DEFAULT_MODE_KEY);
    return coerce(r[DEFAULT_MODE_KEY]);
  } catch {
    return FALLBACK;
  }
}

export async function setDefaultMode(mode: ToolMode): Promise<void> {
  try {
    await chrome.storage.local.set({ [DEFAULT_MODE_KEY]: mode });
  } catch {
    // Storage unavailable (incognito split / quota) — non-fatal; the
    // picker just won't persist this session.
  }
}

/** Subscribe to default-mode changes (e.g. picked in another window's
 *  popup). Returns an unsubscribe fn. */
export function onDefaultModeChange(cb: (mode: ToolMode) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local') return;
    const c = changes[DEFAULT_MODE_KEY];
    if (c == null) return;
    cb(coerce(c.newValue));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
