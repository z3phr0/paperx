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

// TEMP (v0.14.5): transition 模式端到端已建好，但其 floatbar 入口 +
// ChangeLog 筛选项暂时隐藏，直到面板 UX 定稿。模式本体、面板、store、
// 既有 ChangeLog 记录均不受影响。恢复方式：清空下面这个 Set。
export const HIDDEN_TOOL_MODES = new Set<ToolMode>(['transition']);

/** TOOL_MODES 去掉 HIDDEN_TOOL_MODES —— UI 实际暴露的模式。 */
export const VISIBLE_TOOL_MODES = TOOL_MODES.filter(
  (m) => !HIDDEN_TOOL_MODES.has(m),
);
