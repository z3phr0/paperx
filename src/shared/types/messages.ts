/**
 * Cross-context (background <-> content) message contract.
 *
 * Use a discriminated union so chrome.runtime.onMessage handlers can switch
 * on `type` with full TS narrowing.
 */
export type PaperxMessage =
  | { type: 'PAPERX_TOGGLE' }
  | { type: 'PAPERX_PING' };

export const PAPERX_TOGGLE = 'PAPERX_TOGGLE' as const;
export const PAPERX_PING = 'PAPERX_PING' as const;
