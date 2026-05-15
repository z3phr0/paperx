/**
 * paperx popup — v0.14 redesign (design handoff PaperXPopup).
 *
 * 320px solid dark panel, four bands:
 *   1. Header  — brand icon + title + active site + master switch +
 *                live status line (enabled / count)
 *   2. Default mode picker — Design / Ruler / Comment (persisted to
 *      chrome.storage.local; the content script applies it on mount)
 *   3. Sync to Claude Code — disabled "Coming soon" placeholder (no
 *      backing feature yet; kept for design fidelity)
 *   4. Footer — version + settings placeholder
 *
 * State surface (all read direct for instant first paint, then live):
 *   - enabled: chrome.storage.session paperx_tab_{id} + SW broadcast
 *   - count:   chrome.storage.session paperx_count_{id} + SW broadcast
 *   - mode:    chrome.storage.local paperx_default_mode
 *   - url:     chrome.tabs active tab
 *
 * The master toggle preserves data-testid="paperx-popup-toggle" +
 * aria-pressed (e2e contract); it is a pill switch with no ON/OFF
 * text — the status line carries the human-readable state.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';

import {
  onTabEnabledChange,
  readTabEnabledFromSession,
  requestToggleTabEnabled,
} from '@/shared/storage/enabled';
import { onCountChange, readCountFromSession } from '@/shared/storage/changeCount';
import {
  DEFAULT_MODE_CHOICES,
  getDefaultMode,
  setDefaultMode,
} from '@/shared/storage/prefs';
import { Icon, type IconName } from '@/shared/ui-v2';
import type { ToolMode } from '@/shared/types/modes';
import iconUrl from '@/assets/icon.png';

declare const __PAPERX_VERSION__: string;

async function getActiveTab(): Promise<{ id: number; url: string } | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id == null) return null;
    return { id: tab.id, url: tab.url ?? '' };
  } catch {
    return null;
  }
}

function prettySite(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return url || '—';
  }
}

const MODE_META: Record<
  (typeof DEFAULT_MODE_CHOICES)[number],
  { label: string; icon: IconName }
> = {
  design: { label: 'Design', icon: 'palette' },
  ruler: { label: 'Ruler', icon: 'ruler' },
  comment: { label: 'Comment', icon: 'message-square' },
};

function App(): React.ReactElement {
  const [enabled, setEnabled] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const [tabId, setTabId] = React.useState<number | null>(null);
  const [site, setSite] = React.useState('—');
  const [mode, setMode] = React.useState<ToolMode>('design');

  React.useEffect(() => {
    void (async () => {
      const tab = await getActiveTab();
      const dm = await getDefaultMode();
      setMode(dm);
      if (tab == null) return;
      setTabId(tab.id);
      setSite(prettySite(tab.url));
      const [en, c] = await Promise.all([
        readTabEnabledFromSession(tab.id),
        readCountFromSession(tab.id),
      ]);
      setEnabled(en);
      setCount(c);
    })();
    const offEnabled = onTabEnabledChange((next) => setEnabled(next));
    const offCount = onCountChange((n) => setCount(n));
    return () => {
      offEnabled();
      offCount();
    };
  }, []);

  const toggle = async (): Promise<void> => {
    if (tabId == null) return;
    setEnabled((prev) => !prev); // optimistic
    await requestToggleTabEnabled(tabId);
  };

  const pickMode = (m: ToolMode): void => {
    setMode(m);
    void setDefaultMode(m);
  };

  const statusText = enabled
    ? count > 0
      ? `Active on this site · ${count} ${count === 1 ? 'change' : 'changes'}`
      : 'Active on this site'
    : 'Paused on this site';

  const divider = '1px solid rgba(255,255,255,0.06)';

  return (
    <div
      style={{
        width: 320,
        background: '#171a1f',
        color: 'var(--text)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div style={{ padding: '14px 14px 10px', borderBottom: divider }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: `url(${iconUrl}) center/cover no-repeat, #000`,
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 12px rgba(208,154,6,0.35)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>PaperX</div>
            <div
              title={site}
              style={{
                fontSize: 10.5,
                color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {site}
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={tabId == null}
            data-testid="paperx-popup-toggle"
            aria-pressed={enabled}
            aria-label={
              enabled ? 'Disable paperx on this tab' : 'Enable paperx on this tab'
            }
            style={{
              width: 38,
              height: 22,
              borderRadius: 11,
              border: '1px solid var(--border)',
              cursor: tabId == null ? 'wait' : 'pointer',
              background: enabled ? 'var(--accent)' : 'var(--bg-input)',
              position: 'relative',
              transition: 'background 0.2s',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: enabled ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>
        <div
          data-testid="paperx-popup-status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            fontSize: 11,
            fontWeight: 600,
            color: enabled ? 'rgb(30,161,79)' : 'var(--text-muted)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: enabled ? '#22C55E' : 'var(--text-muted)',
              boxShadow: enabled ? '0 0 8px #22C55E' : 'none',
            }}
          />
          <span>{statusText}</span>
          {enabled && count > 0 && (
            <span data-testid="paperx-popup-count" style={{ display: 'none' }}>
              {count}
            </span>
          )}
        </div>
      </div>

      {/* ── Default mode ── */}
      <div style={{ padding: '12px 14px', borderBottom: divider }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}
        >
          Default mode
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {DEFAULT_MODE_CHOICES.map((m) => {
            const active = mode === m;
            const meta = MODE_META[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => pickMode(m)}
                data-testid={`paperx-popup-mode-${m}`}
                aria-pressed={active}
                style={{
                  flex: 1,
                  height: 56,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 0',
                  background: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 120ms',
                }}
              >
                <Icon name={meta.icon} size={20} strokeWidth={2} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sync to Claude Code (disabled placeholder) ── */}
      <div
        title="Coming soon"
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: divider,
          opacity: 0.5,
          cursor: 'not-allowed',
        }}
      >
        <Icon
          name="link"
          size={12}
          style={{ color: 'var(--text-secondary)' }}
        />
        <div style={{ flex: 1, fontSize: 11.5 }}>Sync to Claude Code</div>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}
        >
          Coming soon
        </span>
        <button
          type="button"
          disabled
          aria-label="Sync to Claude Code (coming soon)"
          style={{
            width: 30,
            height: 16,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            position: 'relative',
            cursor: 'not-allowed',
            padding: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 1,
              left: 1,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#fff',
              opacity: 0.6,
            }}
          />
        </button>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: '8px 14px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 10,
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          v{__PAPERX_VERSION__}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          disabled
          title="Settings (coming soon)"
          aria-label="Settings (coming soon)"
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'not-allowed',
            opacity: 0.5,
            padding: 0,
          }}
        >
          <Icon name="sliders" size={14} />
        </button>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('paperx-popup-root')!);
root.render(<App />);
