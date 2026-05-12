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
 * S2-A adds the change-log drawer:
 *   - History icon button on the toolbar pill toggles drawer visibility;
 *     a small red indicator shows when the ChangeLog has any records.
 *   - <ChangeLog /> renders as a sibling of the toolbar pill (NOT nested
 *     inside it) so it can position itself freely at the viewport bottom.
 *
 * The toolbar takes its dependencies via the DI container — same UIStore
 * instance as before, plus the Phase 2 stores resolved lazily here.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Pencil, Ruler, MessageSquare, Zap, X, History } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/utils';
import { UIStore } from '@/shared/stores/UIStore';
import { SelectionStore } from '@/shared/stores/SelectionStore';
import { ChangeLogUIStore } from '@/shared/stores/ChangeLogUIStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { TOOL_MODES, TOOL_MODE_LABELS, type ToolMode } from '@/shared/types/modes';
import { getContainer } from '@/shared/di/container';
import { TYPES } from '@/shared/di/tokens';

import { ElementPicker } from './picker/ElementPicker';
import { HoverTooltip } from './overlays/HoverTooltip';
import { ViewportRulers } from './overlays/ViewportRulers';
import { ResizeHandles } from './overlays/ResizeHandles';
import { RotateHandle } from './overlays/RotateHandle';
import { CommentGuides } from './overlays/CommentGuides';
import { SpacingGuides } from './overlays/SpacingGuides';
import { HoverGuides } from './overlays/HoverGuides';
import { DistanceGuides } from './overlays/DistanceGuides';
import { LocateFlash } from './overlays/LocateFlash';
import { SnapGuidelines } from './overlays/snap/SnapGuidelines';
import { SnapStore } from '@/shared/stores/SnapStore';
import { DesignPanelV2 } from './panels/design-v2';
import { CommentPanel } from './panels/comment';
import { TransitionPanel } from './panels/transition';
import { ChangeLog } from './panels/changelog';
import { CommentStore } from '@/shared/stores/CommentStore';

const MODE_ICONS: Record<ToolMode, React.ComponentType<{ className?: string }>> = {
  design: Pencil,
  ruler: Ruler,
  comment: MessageSquare,
  transition: Zap,
};

interface Props {
  store: UIStore;
}

interface ToolbarPillProps extends Props {
  changeLogUIStore: ChangeLogUIStore;
}

const ToolbarPill = observer(({ store, changeLogUIStore }: ToolbarPillProps) => {
  if (!store.visible) return null;
  const recordCount = changeLogUIStore.totalCount;
  const drawerOpen = changeLogUIStore.drawerOpen;
  return (
    <div
      role="toolbar"
      aria-label="paperx toolbar"
      data-testid="paperx-toolbar"
      className="paperx-surface fixed right-6 top-6 z-[2147483647] flex items-center gap-1 rounded-full p-1"
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
            data-testid={`paperx-mode-${m}`}
            onClick={() => store.toggleMode(m)}
            className={cn('rounded-full')}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      {/* S2-A: change-log drawer toggle. Button shows an indicator dot
          when there is at least one recorded change so the user is
          nudged toward export even if the drawer is collapsed. */}
      <Button
        variant={drawerOpen ? 'default' : 'ghost'}
        size="icon"
        aria-pressed={drawerOpen}
        aria-label="Toggle change log"
        title={`Change log (${recordCount})`}
        data-testid="paperx-history"
        onClick={() => changeLogUIStore.toggleDrawer()}
        className="relative rounded-full"
      >
        <History className="h-4 w-4" />
        {recordCount > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-background"
          />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close paperx"
        title="Hide (Cmd+Shift+P)"
        data-testid="paperx-close"
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
  const changeLogUIStore = container.get<ChangeLogUIStore>(TYPES.ChangeLogUIStore);
  const commentStore = container.get<CommentStore>(TYPES.CommentStore);
  const snapStore = container.get<SnapStore>(TYPES.SnapStore);

  return (
    <>
      <ToolbarPill store={store} changeLogUIStore={changeLogUIStore} />
      <ElementPicker uiStore={store} selectionStore={selectionStore} />
      <HoverTooltip uiStore={store} selectionStore={selectionStore} />
      <ViewportRulers uiStore={store} selectionStore={selectionStore} />
      <SnapGuidelines snapStore={snapStore} />
      <ResizeHandles
        uiStore={store}
        selectionStore={selectionStore}
        snapStore={snapStore}
        styleEdit={styleEdit}
      />
      <RotateHandle uiStore={store} selectionStore={selectionStore} styleEdit={styleEdit} />
      <CommentGuides uiStore={store} selectionStore={selectionStore} />
      <SpacingGuides uiStore={store} selectionStore={selectionStore} />
      <HoverGuides uiStore={store} selectionStore={selectionStore} />
      <DistanceGuides uiStore={store} selectionStore={selectionStore} />
      <LocateFlash uiStore={store} commentStore={commentStore} />
      <DesignPanelV2 uiStore={store} selectionStore={selectionStore} styleEdit={styleEdit} />
      {/* Legacy V1 RulerPanel retired in design-v2: ruler mode now
          renders the V2 Inspect view (BoxModel + CodeBlock) through
          DesignPanelV2 above. The V1 file is kept in tree for rollback
          but no longer mounted. */}
      <CommentPanel
        uiStore={store}
        selectionStore={selectionStore}
        commentStore={commentStore}
      />
      <TransitionPanel uiStore={store} selectionStore={selectionStore} styleEdit={styleEdit} />
      <ChangeLog uiStore={store} />
    </>
  );
});
FloatingToolbar.displayName = 'FloatingToolbar';
