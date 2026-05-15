/**
 * paperx content script entry — Shadow DOM bootstrap (R1 decision: option A).
 *
 * Strategy:
 *   1. Append a mount node directly under <html> (NOT <body>, so we
 *      survive sites that re-render <body> like SPAs).
 *   2. attachShadow({ mode: 'open' }) so DevTools can inspect; switch to
 *      'closed' in Phase 2 once stable.
 *   3. Inject the Tailwind-compiled CSS as a single <style> inside the
 *      shadow root. CRXJS emits the CSS file when imported here.
 *   4. Mount React onto a <div> inside the shadow root.
 *   5. Subscribe chrome.runtime.onMessage('PAPERX_TOGGLE') -> UIStore.toggle().
 *
 * The host page sees only an empty <paperx-root> custom element; all
 * paperx CSS, classNames, and DOM live inside the shadow tree, satisfying
 * R1 (UI isolation).
 */
import 'reflect-metadata';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import tailwindCss from '@/shared/styles/tailwind.css?inline';
import designV2Css from '@/shared/styles/design-v2.css?inline';
import { reaction, type IReactionDisposer } from 'mobx';

import { getContainer } from '@/shared/di/container';
import { TYPES } from '@/shared/di/tokens';
import { UIStore } from '@/shared/stores/UIStore';
import type { ChangeLogUIStore } from '@/shared/stores/ChangeLogUIStore';
import { FloatingToolbar } from './FloatingToolbar';
import { PAPERX_TOGGLE, type PaperxMessage } from '@/shared/types/messages';
import { PortalProvider } from '@/shared/ui/portal';
import { onTabEnabledChange, requestTabEnabled } from '@/shared/storage/enabled';
import { getDefaultMode } from '@/shared/storage/prefs';
import { reportCount } from '@/shared/storage/changeCount';

const HOST_TAG = 'paperx-root';

function ensureHost(): HTMLElement {
  let host = document.querySelector<HTMLElement>(HOST_TAG);
  if (host) return host;
  host = document.createElement(HOST_TAG);
  host.setAttribute('data-paperx', '1');
  // Insert under <html> so SPA <body> re-renders don't unmount us.
  (document.documentElement || document.body).appendChild(host);
  return host;
}

interface MountResult {
  shadow: ShadowRoot;
  root: Root;
  store: UIStore;
}

function mount(): MountResult {
  const host = ensureHost();
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject compiled Tailwind CSS + design-v2 stylesheet inside the
  // shadow root. design-v2 owns the inspector visual system (gold accent,
  // macOS-glass surfaces) used by the V2 design panel; all selectors are
  // `dv-`-prefixed so they cannot collide with Tailwind atomics.
  const style = document.createElement('style');
  style.textContent = `${tailwindCss}\n${designV2Css}`;
  shadow.appendChild(style);

  // React mount node. theme + density attributes are read by design-v2.css
  // descendant selectors (`[data-theme="dark"] { --dv-bg: ... }`) so all
  // V2 design tokens cascade from this element down.
  const reactMount = document.createElement('div');
  reactMount.id = 'paperx-react-root';
  reactMount.setAttribute('data-theme', 'dark');
  reactMount.setAttribute('data-density', 'compact');
  shadow.appendChild(reactMount);

  // Sibling layer for Radix Portal targets (Popover/Dialog/Tooltip/...).
  // Radix's Portal accepts an HTMLElement, not a ShadowRoot — and we want
  // the portaled overlays to live INSIDE the shadow tree so the same
  // injected stylesheet applies and host-page CSS cannot bleed in.
  const portalLayer = document.createElement('div');
  portalLayer.id = 'paperx-portal-layer';
  // Position it absolutely so it never displaces the React tree. Radix
  // overlays compute their own coordinates via Floating UI.
  // Overlays painted into this layer must visually sit above the floating
  // toolbar (which uses the int32-max z-index). We match it and rely on
  // DOM order — portalLayer is appended after reactMount so ties resolve
  // in our favor. The layer itself is pointer-events:none; Radix overlay
  // children re-enable pointer events on themselves.
  portalLayer.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  shadow.appendChild(portalLayer);

  // DI bootstrap.
  const container = getContainer();
  const store = container.get<UIStore>(TYPES.UIStore);

  const root = createRoot(reactMount);
  root.render(
    <React.StrictMode>
      <PortalProvider container={portalLayer}>
        <FloatingToolbar store={store} />
      </PortalProvider>
    </React.StrictMode>,
  );

  return { shadow, root, store };
}

function wireMessageBridge(store: UIStore): void {
  chrome.runtime.onMessage.addListener((msg: PaperxMessage) => {
    if (msg?.type === PAPERX_TOGGLE) {
      store.toggle();
    }
  });
}

// Lifecycle state — the popup's global toggle adds/removes paperx from
// every tab via chrome.storage.onChanged. We tear the whole shadow root
// down on disable so host pages render with zero paperx surface.
let mounted: MountResult | null = null;
let disposeCountReaction: IReactionDisposer | null = null;

function unmount(): void {
  if (!mounted) return;
  if (disposeCountReaction) {
    disposeCountReaction();
    disposeCountReaction = null;
  }
  // Zero the badge proactively. The SW also clears on disable, but a
  // bare unmount (e.g. SPA teardown without an enabled flip) wouldn't
  // otherwise reset it.
  void reportCount(0);
  try {
    mounted.root.unmount();
  } catch (err) {
    console.warn('[paperx/content] unmount failed', err);
  }
  document.querySelector(HOST_TAG)?.remove();
  mounted = null;
}

function startMounted(): void {
  // Guard against double-injection (e.g. from CRXJS HMR or re-injection on
  // SPA navigation). The custom-element check on the host tag is enough.
  if (mounted || document.querySelector(HOST_TAG)) {
    console.info('[paperx/content] already mounted, skipping');
    return;
  }
  mounted = mount();
  // Start visible by default so reviewers immediately see the toolbar
  // after the global enable flip; per-tab visibility lives in UIStore.
  mounted.store.show();
  // Apply the user's persisted default mode ONLY if they explicitly
  // picked one. null = never chosen → keep the legacy mode=null start
  // so the toolbar's toggle-off semantics don't fight flows that
  // assume no mode is pre-selected.
  void getDefaultMode().then((m) => {
    if (m != null) mounted?.store.setMode(m);
  });
  wireMessageBridge(mounted.store);

  // Push the ChangeLog total to the SW whenever it moves so the action
  // badge + popup count stay live. rAF-batched so a burst of edits
  // collapses to one message per frame; identical counts are skipped
  // by the reaction's default equality check.
  const container = getContainer();
  const clui = container.get<ChangeLogUIStore>(TYPES.ChangeLogUIStore);
  let raf = 0;
  disposeCountReaction = reaction(
    () => clui.totalCount,
    (n) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => void reportCount(n));
    },
    { fireImmediately: true },
  );
  console.info('[paperx/content] mounted in shadow DOM');
}

// Per-tab init: ask the SW whether THIS tab is enabled. Default OFF.
// SW tracks state in an in-memory `Map<tabId, boolean>`; the content
// script relies on `sender.tab.id` so we don't pass a tabId here.
void requestTabEnabled().then((on) => {
  if (on) startMounted();
});

onTabEnabledChange((on) => {
  if (on) startMounted();
  else unmount();
});

export {};
