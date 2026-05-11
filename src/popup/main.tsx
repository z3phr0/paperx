/**
 * paperx popup — global enable/disable switch.
 *
 * Reads + writes `paperx_enabled` in chrome.storage.local. Content
 * scripts subscribe to chrome.storage.onChanged separately, so the
 * popup doesn't need to dispatch any cross-context messages; the
 * storage change propagates across every tab automatically.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';

import {
  DEFAULT_ENABLED,
  onEnabledChange,
  readEnabled,
  writeEnabled,
} from '@/shared/storage/enabled';

declare const __PAPERX_VERSION__: string;

function App(): React.ReactElement {
  const [enabled, setEnabled] = React.useState<boolean>(DEFAULT_ENABLED);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void readEnabled().then((v) => {
      setEnabled(v);
      setLoading(false);
    });
    return onEnabledChange((next) => setEnabled(next));
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next); // optimistic
    await writeEnabled(next);
  };

  const label = loading ? 'Loading…' : enabled ? 'paperx is ON' : 'paperx is OFF';
  const subLabel = loading
    ? ''
    : enabled
      ? 'Floating toolbar active on every tab.'
      : 'No injection. Pages render untouched.';

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
        disabled={loading}
        data-testid="paperx-popup-toggle"
        aria-pressed={enabled}
        aria-label={enabled ? 'Disable paperx' : 'Enable paperx'}
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
          cursor: loading ? 'wait' : 'pointer',
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
        {loading ? '…' : enabled ? 'ON' : 'OFF'}
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
