/**
 * paperx popup — per-tab enable/disable switch.
 *
 * On open, queries the SW for the active tab's enabled state and renders
 * a big circular toggle. Clicking flips the active tab's state via
 * `requestToggleTabEnabled`; the SW broadcasts to that tab so the
 * content script mounts / unmounts. Other tabs are unaffected.
 *
 * The same toggle can be invoked without opening the popup at all via
 * `Cmd+Shift+P` / `Ctrl+Shift+P` — the SW handles `chrome.commands`
 * directly. The popup is the discoverable entry point; the hotkey is
 * the high-frequency one.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';

import {
  onTabEnabledChange,
  readTabEnabledFromSession,
  requestToggleTabEnabled,
} from '@/shared/storage/enabled';

declare const __PAPERX_VERSION__: string;

async function getActiveTabId(): Promise<number | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  } catch {
    return null;
  }
}

function App(): React.ReactElement {
  // Optimistic OFF as the initial state — matches the new-tab default
  // for the per-tab semantics. Reading actual state from
  // `chrome.storage.session` happens in parallel and silently updates
  // (typically < 30ms total: tabs.query + session.get, both local IPC).
  // No spinner / "Loading…" UI: prior v0.7.0 design awaited the SW which
  // could be 50-300ms cold start; v0.7.1 reads session storage directly
  // so the toggle is interactive on first paint.
  const [enabled, setEnabled] = React.useState<boolean>(false);
  const [tabId, setTabId] = React.useState<number | null>(null);

  React.useEffect(() => {
    void (async () => {
      const id = await getActiveTabId();
      if (id == null) return;
      setTabId(id);
      const cur = await readTabEnabledFromSession(id);
      setEnabled(cur);
    })();
    // The popup runs in the extension context; the SW broadcasts
    // PAPERX_ENABLED_CHANGED into tabs (not popup), but onMessage in
    // the popup also fires when a runtime.sendMessage is in flight.
    // Subscribe defensively — if the user toggles via hotkey while
    // the popup is open, sync state.
    return onTabEnabledChange((next) => setEnabled(next));
  }, []);

  const toggle = async () => {
    if (tabId == null) return;
    setEnabled((prev) => !prev); // optimistic
    await requestToggleTabEnabled(tabId);
  };

  const label = enabled
    ? 'paperx is ON on this tab'
    : 'paperx is OFF on this tab';
  const subLabel = enabled
    ? 'Floating toolbar active here. Other tabs unaffected.'
    : 'Press Cmd+Shift+P to toggle. Default OFF on every new tab.';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 18px 16px',
        height: '100%',
        minHeight: 320,
        boxSizing: 'border-box',
      }}
    >
      <header style={{ alignSelf: 'stretch', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'hsl(0 0% 62%)',
          }}
        >
          paperx · v{__PAPERX_VERSION__}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 17,
            fontWeight: 600,
            color: 'hsl(0 0% 96%)',
          }}
        >
          {label}
        </div>
      </header>

      <button
        type="button"
        onClick={toggle}
        disabled={tabId == null}
        data-testid="paperx-popup-toggle"
        aria-pressed={enabled}
        aria-label={enabled ? 'Disable paperx on this tab' : 'Enable paperx on this tab'}
        style={{
          width: 140,
          height: 140,
          borderRadius: '50%',
          border: enabled
            ? '2px solid rgba(34, 211, 238, 0.7)'
            : '2px solid rgba(255, 255, 255, 0.18)',
          background: enabled
            ? 'radial-gradient(circle at 35% 30%, rgba(34,211,238,0.45), rgba(244,63,94,0.45) 70%, rgba(0,0,0,0.4))'
            : 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 70%, rgba(0,0,0,0.4))',
          color: 'hsl(0 0% 100%)',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.1em',
          cursor: tabId == null ? 'wait' : 'pointer',
          outline: 'none',
          transition: 'transform 120ms ease, box-shadow 200ms ease, border-color 200ms ease',
          boxShadow: enabled
            ? '0 8px 32px -8px rgba(34, 211, 238, 0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
            : '0 6px 24px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
          textShadow: enabled ? '0 1px 12px rgba(34, 211, 238, 0.6)' : 'none',
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>

      <footer style={{ alignSelf: 'stretch', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.5,
            color: 'hsl(0 0% 62%)',
            maxWidth: 240,
            margin: '0 auto',
          }}
        >
          {subLabel}
        </div>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('paperx-popup-root')!);
root.render(<App />);
