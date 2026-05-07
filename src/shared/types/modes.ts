/**
 * paperx tool modes — the four operating contexts the floating toolbar
 * exposes. Phase 1 only renders the mode buttons; behavior (DOM editing,
 * ruler overlay, ...) lands in Phase 2+.
 */
export const TOOL_MODES = ['design', 'ruler', 'comment', 'layout'] as const;

export type ToolMode = (typeof TOOL_MODES)[number];

export const TOOL_MODE_LABELS: Record<ToolMode, string> = {
  design: 'Design',
  ruler: 'Ruler',
  comment: 'Comment',
  layout: 'Layout',
};
