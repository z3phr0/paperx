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

/** Display fallback the popup picker highlights when the user has
 *  never explicitly chosen — NOT applied to the content script. */
export const DEFAULT_MODE_DISPLAY: ToolMode = 'design';

function coerce(v: unknown): ToolMode | null {
  return DEFAULT_MODE_CHOICES.includes(v as never) ? (v as ToolMode) : null;
}

/**
 * The user's explicitly-chosen default mode, or `null` when unset /
 * invalid. Null is load-bearing: the content script only overrides
 * UIStore.mode when this is non-null, so a user who never touched the
 * picker keeps the legacy mode=null start (toolbar visible, no panel
 * until a mode button is clicked). Pre-applying 'design' here would
 * make the toolbar's toggle-off semantics fight every flow that
 * assumes a null start.
 */
export async function getDefaultMode(): Promise<ToolMode | null> {
  try {
    const r = await chrome.storage.local.get(DEFAULT_MODE_KEY);
    return coerce(r[DEFAULT_MODE_KEY]);
  } catch {
    return null;
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
    const next = coerce(c.newValue);
    if (next != null) cb(next);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
