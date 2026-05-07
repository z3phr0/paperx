/**
 * FloatingToolbar — the always-on-top React component rendered inside the
 * content-script Shadow DOM. Phase 1 ships:
 *   - top-right hovering pill
 *   - 4 mode buttons (design/ruler/comment/layout) bound to UIStore.mode
 *   - close (×) button calls UIStore.hide()
 *   - togglable via background's PAPERX_TOGGLE message
 *
 * Phase 2 (this commit) layers on the design-mode picker + side panel:
 *   - <ElementPicker /> — DOM hit-test active when mode === 'design'
 *   - <DesignPanel />   — right-side drawer for inline-style edits
 *
 * Both sub-components are siblings of the toolbar pill (NOT nested inside
 * it) so they can position themselves freely. The toolbar takes its
 * dependencies via the DI container — same UIStore instance as before,
 * plus the new SelectionStore + StyleEditService.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Pencil, Ruler, MessageSquare, LayoutGrid, X } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/utils';
import { UIStore } from '@/shared/stores/UIStore';
import { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { TOOL_MODES, TOOL_MODE_LABELS, type ToolMode } from '@/shared/types/modes';
import { getContainer } from '@/shared/di/container';
import { TYPES } from '@/shared/di/tokens';

import { ElementPicker } from './picker/ElementPicker';
import { DesignPanel } from './panels/design';

const MODE_ICONS: Record<ToolMode, React.ComponentType<{ className?: string }>> = {
  design: Pencil,
  ruler: Ruler,
  comment: MessageSquare,
  layout: LayoutGrid,
};

interface Props {
  store: UIStore;
}

const ToolbarPill = observer(({ store }: Props) => {
  if (!store.visible) return null;
  return (
    <div
      role="toolbar"
      aria-label="paperx toolbar"
      className="fixed right-6 top-6 z-[2147483647] flex items-center gap-1 rounded-full border bg-background p-1 shadow-lg"
      // Defensive: any click on the toolbar must not be hijacked by the
      // picker's window-level click listener (capture phase).
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
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
ToolbarPill.displayName = 'ToolbarPill';

export const FloatingToolbar = observer(({ store }: Props) => {
  // Pull the rest of our dependencies from the singleton container. We
  // resolve them lazily here (rather than threading props from index.tsx)
  // so the bootstrap entry point — which is owned by P0-1 — does not need
  // to know about Phase 2 stores at all.
  const container = getContainer();
  const selectionStore = container.get<SelectionStore>(TYPES.SelectionStore);
  const styleEdit = container.get<IStyleEditService>(TYPES.StyleEditService);

  return (
    <>
      <ToolbarPill store={store} />
      <ElementPicker uiStore={store} selectionStore={selectionStore} />
      <DesignPanel uiStore={store} selectionStore={selectionStore} styleEdit={styleEdit} />
    </>
  );
});
FloatingToolbar.displayName = 'FloatingToolbar';
