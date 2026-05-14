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
import { Pencil, Ruler, MessageSquare, Zap, X, History, GripVertical } from 'lucide-react';

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
import { CommentAnnotations } from './overlays/CommentAnnotations';
import { SnapGuidelines } from './overlays/snap/SnapGuidelines';
import { SnapStore } from '@/shared/stores/SnapStore';
import { DesignPanelV2 } from './panels/design-v2';
import { CommentPanelV2 } from './panels/comment-v2';
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

const MARGIN = 8;

const ToolbarPill = observer(({ store, changeLogUIStore }: ToolbarPillProps) => {
  // CLAUDE.md: hooks order is sacred. Declare every hook BEFORE any
  // `if (...) return null` so React's hook indices stay stable across
  // visibility flips.
  const pillRef = React.useRef<HTMLDivElement | null>(null);
  // Captured at pointerdown: offset from pill's top-left to the cursor.
  // Ref instead of state so we don't trigger re-render mid-drag.
  const dragOffsetRef = React.useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);

  if (!store.visible) return null;
  const recordCount = changeLogUIStore.totalCount;
  const drawerVisible = changeLogUIStore.drawerVisible;

  const onGripPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!pillRef.current) return;
    if (e.button !== 0) return; // primary button only
    const rect = pillRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const onGripPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragOffsetRef.current || !pillRef.current) return;
    const rect = pillRef.current.getBoundingClientRect();
    const { dx, dy } = dragOffsetRef.current;
    const maxX = window.innerWidth - rect.width - MARGIN;
    const maxY = window.innerHeight - rect.height - MARGIN;
    const x = Math.max(MARGIN, Math.min(maxX, e.clientX - dx));
    const y = Math.max(MARGIN, Math.min(maxY, e.clientY - dy));
    store.setToolbarPosition({ x, y });
  };

  const onGripPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragOffsetRef.current) return;
    dragOffsetRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Position style: default (null) keeps the Tailwind top-6 right-6
  // recipe; once the user has dragged, switch to explicit left/top.
  const positioned = store.toolbarPosition != null;
  const positionStyle: React.CSSProperties = positioned
    ? {
        left: `${store.toolbarPosition!.x}px`,
        top: `${store.toolbarPosition!.y}px`,
        right: 'auto',
      }
    : {};

  return (
    <div
      ref={pillRef}
      role="toolbar"
      aria-label="paperx toolbar"
      data-testid="paperx-toolbar"
      className={cn(
        'paperx-surface fixed z-[2147483647] flex items-center gap-1 rounded-full p-1',
        positioned ? null : 'right-6 top-6',
      )}
      style={positionStyle}
      // Defensive: any click on the toolbar must not be hijacked by the
      // picker's window-level click listener (capture phase).
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag toolbar"
        title="Drag to move"
        data-testid="paperx-toolbar-drag"
        onPointerDown={onGripPointerDown}
        onPointerMove={onGripPointerMove}
        onPointerUp={onGripPointerUp}
        onPointerCancel={onGripPointerUp}
        // Block the picker even when the user just clicks the grip
        // without dragging.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex h-7 w-5 cursor-grab items-center justify-center rounded-full',
          'text-muted-foreground hover:text-foreground',
          dragging && 'cursor-grabbing',
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>
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
      {/* v0.11.10: button shows / hides the ChangeLog panel entirely
          (drawer rendered to viewport vs unmounted). The drawer's own
          chevron handles body collapse independently. */}
      <Button
        variant={drawerVisible ? 'default' : 'ghost'}
        size="icon"
        aria-pressed={drawerVisible}
        aria-label="Toggle change log panel"
        title={`Change log (${recordCount})`}
        data-testid="paperx-history"
        onClick={() => changeLogUIStore.toggleDrawerVisible()}
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
      <CommentAnnotations
        uiStore={store}
        selectionStore={selectionStore}
        commentStore={commentStore}
      />
      <DesignPanelV2 uiStore={store} selectionStore={selectionStore} styleEdit={styleEdit} />
      {/* Legacy V1 RulerPanel retired in design-v2: ruler mode now
          renders the V2 Inspect view (BoxModel + CodeBlock) through
          DesignPanelV2 above. The V1 file is kept in tree for rollback
          but no longer mounted. */}
      <CommentPanelV2
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
