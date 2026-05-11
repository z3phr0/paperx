/**
 * paperx tool modes — the operating contexts the floating toolbar
 * exposes. Sprint 3 adds 'transition' for the animation panel + cubic
 * bezier editor.
 */
export const TOOL_MODES = [
  'design',
  'ruler',
  'comment',
  'transition',
] as const;

export type ToolMode = (typeof TOOL_MODES)[number];

export const TOOL_MODE_LABELS: Record<ToolMode, string> = {
  design: 'Design',
  ruler: 'Ruler',
  comment: 'Comment',
  transition: 'Transition',
};
