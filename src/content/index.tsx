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
import { getContainer } from '@/shared/di/container';
import { TYPES } from '@/shared/di/tokens';
import { UIStore } from '@/shared/stores/UIStore';
import { FloatingToolbar } from './FloatingToolbar';
import { PAPERX_TOGGLE, type PaperxMessage } from '@/shared/types/messages';
import { PortalProvider } from '@/shared/ui/portal';
import { onEnabledChange, readEnabled } from '@/shared/storage/enabled';

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

  // Inject compiled Tailwind CSS inside the shadow root.
  const style = document.createElement('style');
  style.textContent = tailwindCss;
  shadow.appendChild(style);

  // React mount node.
  const reactMount = document.createElement('div');
  reactMount.id = 'paperx-react-root';
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

function unmount(): void {
  if (!mounted) return;
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
  wireMessageBridge(mounted.store);
  console.info('[paperx/content] mounted in shadow DOM');
}

void readEnabled().then((on) => {
  if (on) startMounted();
});

onEnabledChange((on) => {
  if (on) startMounted();
  else unmount();
});

export {};
