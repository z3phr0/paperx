/**
 * ChangeLogRow — single ChangeLog entry rendered in the drawer body.
 *
 * Layout (32 px tall):
 *   [mode-badge] [selector ≈ 28%] [property: before → after ≈ 60%] [ts] [⌖ ↶]
 *
 * The locate (⌖) and undo (↶) buttons are spec'd to be inline. Locate
 * resolves the row's record id through ChangeLogService.getTargetById
 * (the canonical path — points at the exact element StyleEditService
 * mutated, even if the host page also has structurally similar
 * siblings) and falls back to document.querySelector(record.selector)
 * when the element has been GCed / detached. The element is then
 * scrolled into view and outlined for ~800 ms. Undo delegates to
 * StyleEditService.undo(record.id).
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Crosshair, Undo2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/utils';
import { TYPES } from '@/shared/di/tokens';
import { getContainer } from '@/shared/di/container';
import type {
  ChangeRecord,
  IChangeLogService,
} from '@/shared/services/ChangeLogService';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import type { ChangeLogUIStore } from '@/shared/stores/ChangeLogUIStore';
import type { ToolMode } from '@/shared/types/modes';

const MODE_BADGE_CLASS: Record<ToolMode, string> = {
  design: 'bg-blue-500/15 text-blue-700',
  ruler: 'bg-amber-500/15 text-amber-700',
  comment: 'bg-emerald-500/15 text-emerald-700',
  layout: 'bg-purple-500/15 text-purple-700',
  transition: 'bg-pink-500/15 text-pink-700',
};

const PULSE_MS = 800;

function formatTime(ts: number): string {
  const d = new Date(ts);
  // hh:mm:ss in local time. Drop the date — the drawer is for the
  // current session and noisy timestamps don't help.
  return d.toLocaleTimeString(undefined, { hour12: false });
}

/** Apply a temporary outline to `el` and remove it after PULSE_MS. */
function pulse(el: HTMLElement): void {
  const prevOutline = el.style.outline;
  const prevOffset = el.style.outlineOffset;
  const prevTrans = el.style.transition;
  el.style.outline = '2px solid #f97316';
  el.style.outlineOffset = '2px';
  el.style.transition = 'outline 200ms ease-out';
  window.setTimeout(() => {
    // Restore. Empty string clears the inline override.
    el.style.outline = prevOutline;
    el.style.outlineOffset = prevOffset;
    el.style.transition = prevTrans;
  }, PULSE_MS);
}

export interface ChangeLogRowProps {
  record: ChangeRecord;
  styleEdit: IStyleEditService;
  uiStore: ChangeLogUIStore;
}

export const ChangeLogRow = observer(
  ({ record, styleEdit, uiStore }: ChangeLogRowProps) => {
    const isPinned = uiStore.pinnedRecordId === record.id;
    const rowRef = React.useRef<HTMLDivElement | null>(null);
    // Resolve once per row. The DI container is a singleton so this
    // doesn't actually re-instantiate anything; we just need the
    // log service's id-to-element lookup.
    const log = React.useMemo(
      () => getContainer().get<IChangeLogService>(TYPES.ChangeLogService),
      [],
    );

    // When pinned, scroll the row into view so the user immediately
    // sees which entry was just located.
    React.useEffect(() => {
      if (isPinned && rowRef.current) {
        rowRef.current.scrollIntoView({ block: 'nearest' });
      }
    }, [isPinned]);

    const handleLocate = React.useCallback(() => {
      // Preferred path: ChangeLogService.getTargetById — points at
      // the exact element StyleEditService mutated, immune to
      // structural ambiguity in the selector (e.g. multiple
      // `div.card` siblings).
      let el: HTMLElement | null = log.getTargetById(record.id);
      // Fallback: query by recorded selector. Only used when the
      // element has been GCed / detached (re-render). Surface a
      // console warning rather than throw if the selector is invalid.
      if (!el) {
        try {
          el = document.querySelector(record.selector) as HTMLElement | null;
        } catch (err) {
          console.warn('[paperx/ChangeLogRow] querySelector failed', err);
        }
      }
      if (!el) {
        // Pin anyway so the user sees we acknowledged the click.
        uiStore.pin(record.id);
        return;
      }
      uiStore.pin(record.id);
      try {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {
        el.scrollIntoView();
      }
      pulse(el);
    }, [log, record.id, record.selector, uiStore]);

    const handleUndo = React.useCallback(() => {
      // If the row was pinned, unpin it before undoing — the row is
      // about to disappear from the rendered list.
      if (uiStore.pinnedRecordId === record.id) uiStore.unpin();
      styleEdit.undo(record.id);
    }, [record.id, styleEdit, uiStore]);

    return (
      <div
        ref={rowRef}
        role="row"
        className={cn(
          'flex h-8 items-center gap-2 rounded px-2 text-[11px]',
          'border-b border-border/40 last:border-b-0',
          isPinned ? 'bg-amber-500/10 outline outline-1 outline-amber-500/40' : 'hover:bg-accent/40',
        )}
      >
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide',
            MODE_BADGE_CLASS[record.mode],
          )}
          title={record.mode}
        >
          {record.mode[0]}
        </span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-muted-foreground"
          title={record.selector}
        >
          {record.selector || '(no selector)'}
        </span>
        <span
          className="min-w-0 max-w-[55%] flex-1 truncate font-mono"
          title={`${record.property}: ${record.before} → ${record.after}`}
        >
          <span className="font-semibold">{record.property}</span>
          <span className="text-muted-foreground">: </span>
          <span className="line-through text-muted-foreground">{record.before || '∅'}</span>
          <span className="text-muted-foreground"> → </span>
          <span>{record.after || '∅'}</span>
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground" title={new Date(record.ts).toISOString()}>
          {formatTime(record.ts)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Locate ${record.selector}`}
          title="Locate (scroll & flash)"
          onClick={handleLocate}
          className="h-6 w-6 shrink-0"
        >
          <Crosshair className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Undo change to ${record.property}`}
          title="Undo this change"
          onClick={handleUndo}
          className="h-6 w-6 shrink-0"
        >
          <Undo2 className="h-3 w-3" />
        </Button>
      </div>
    );
  },
);
ChangeLogRow.displayName = 'ChangeLogRow';
