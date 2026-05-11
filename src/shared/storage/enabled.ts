/**
 * Global enabled state — persisted in chrome.storage.local so the
 * switch is shared across every tab the user has open and across
 * extension reloads. Listeners use chrome.storage.onChanged for
 * cross-tab broadcast (Chrome's canonical mechanism — no message
 * fan-out from the service worker needed).
 *
 * Default is `true` (extension on) so first-install users see the
 * floating toolbar without having to flip the popup.
 */

export const ENABLED_KEY = 'paperx_enabled' as const;
export const DEFAULT_ENABLED = true;

export async function readEnabled(): Promise<boolean> {
  try {
    const v = await chrome.storage.local.get(ENABLED_KEY);
    const raw = v[ENABLED_KEY];
    if (typeof raw === 'boolean') return raw;
    return DEFAULT_ENABLED;
  } catch {
    return DEFAULT_ENABLED;
  }
}

export async function writeEnabled(next: boolean): Promise<void> {
  await chrome.storage.local.set({ [ENABLED_KEY]: next });
}

/**
 * Subscribe to changes of the enabled flag across tabs. Returns an
 * unsubscribe function.
 */
export function onEnabledChange(cb: (next: boolean) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local') return;
    const entry = changes[ENABLED_KEY];
    if (!entry) return;
    const next = typeof entry.newValue === 'boolean' ? entry.newValue : DEFAULT_ENABLED;
    cb(next);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
