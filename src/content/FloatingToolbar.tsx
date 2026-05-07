/**
 * FloatingToolbar — the always-on-top React component rendered inside the
 * content-script Shadow DOM. Phase 1 surface:
 *   - top-right hovering pill
 *   - 4 mode buttons (design/ruler/comment/layout) bound to UIStore.mode
 *   - close (×) button calls UIStore.hide()
 *   - togglable via background's PAPERX_TOGGLE message
 *
 * Phase 2+ will graft on the per-mode side panels and the bottom
 * change-log drawer.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Pencil, Ruler, MessageSquare, LayoutGrid, X } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/utils';
import { UIStore } from '@/shared/stores/UIStore';
import { TOOL_MODES, TOOL_MODE_LABELS, type ToolMode } from '@/shared/types/modes';

const MODE_ICONS: Record<ToolMode, React.ComponentType<{ className?: string }>> = {
  design: Pencil,
  ruler: Ruler,
  comment: MessageSquare,
  layout: LayoutGrid,
};

interface Props {
  store: UIStore;
}

export const FloatingToolbar = observer(({ store }: Props) => {
  if (!store.visible) return null;
  return (
    <div
      role="toolbar"
      aria-label="paperx toolbar"
      className="fixed right-6 top-6 z-[2147483647] flex items-center gap-1 rounded-full border bg-background p-1 shadow-lg"
    >
      {TOOL_MODES.map((m) => {
        const Icon = MODE_ICONS[m];
        const active = store.mode === m;
        return (
          <Button
            key={m}
            variant={active ? 'default' : 'ghost'}
            size="icon"
            aria-pressed={active}
            aria-label={TOOL_MODE_LABELS[m]}
            title={TOOL_MODE_LABELS[m]}
            onClick={() => store.setMode(m)}
            className={cn('rounded-full')}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close paperx"
        title="Hide (Cmd+Shift+P)"
        onClick={() => store.hide()}
        className="rounded-full"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
});
FloatingToolbar.displayName = 'FloatingToolbar';
