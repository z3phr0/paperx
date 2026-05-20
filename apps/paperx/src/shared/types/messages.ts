/**
 * Cross-context (background <-> content / popup) message contract.
 *
 * Use a discriminated union so chrome.runtime.onMessage handlers can switch
 * on `type` with full TS narrowing.
 */
export type PaperxMessage =
  | { type: 'PAPERX_TOGGLE' }
  | { type: 'PAPERX_PING' }
  // Per-tab enabled state — owned by the SW in-memory map.
  | { type: 'PAPERX_QUERY_ENABLED'; tabId?: number }
  | { type: 'PAPERX_SET_ENABLED'; tabId: number; value: boolean }
  | { type: 'PAPERX_TOGGLE_ENABLED'; tabId: number }
  | { type: 'PAPERX_ENABLED_CHANGED'; enabled: boolean }
  // Per-tab ChangeLog count — content script reports it, the SW
  // caches it in session + paints the action badge + rebroadcasts
  // so an open popup can mirror it live.
  | { type: 'PAPERX_REPORT_COUNT'; count: number }
  | { type: 'PAPERX_COUNT_CHANGED'; count: number };

export const PAPERX_TOGGLE = 'PAPERX_TOGGLE' as const;
export const PAPERX_PING = 'PAPERX_PING' as const;
export const PAPERX_QUERY_ENABLED = 'PAPERX_QUERY_ENABLED' as const;
export const PAPERX_SET_ENABLED = 'PAPERX_SET_ENABLED' as const;
export const PAPERX_TOGGLE_ENABLED = 'PAPERX_TOGGLE_ENABLED' as const;
export const PAPERX_ENABLED_CHANGED = 'PAPERX_ENABLED_CHANGED' as const;
export const PAPERX_REPORT_COUNT = 'PAPERX_REPORT_COUNT' as const;
export const PAPERX_COUNT_CHANGED = 'PAPERX_COUNT_CHANGED' as const;
