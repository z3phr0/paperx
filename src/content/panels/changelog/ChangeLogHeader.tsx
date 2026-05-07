/**
 * ChangeLogHeader — sticky header row inside the change-log drawer.
 *
 * Layout: [collapse caret] Title + counts + filter-toggle + reset-all
 * + Export-Prompt + (status: copied indicator).
 *
 * `Export Prompt` calls JsonPromptExporter.copyToClipboard (passing the
 * Shadow-DOM portal layer so the textarea fallback stays inside our
 * isolated tree). We surface a transient "Copied" / "Failed" badge for
 * ~1.5s so the user gets feedback even when the toolbar is the only UI
 * surface they're looking at.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronDown, ChevronUp, Filter, Trash2, ClipboardCopy, Check, AlertTriangle } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/utils';
import { usePortalContainer } from '@/shared/ui/portal';
import type { ChangeLogUIStore } from '@/shared/stores/ChangeLogUIStore';
import type { IJsonPromptExporter } from '@/shared/services/JsonPromptExporter';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

export interface ChangeLogHeaderProps {
  uiStore: ChangeLogUIStore;
  exporter: IJsonPromptExporter;
  styleEdit: IStyleEditService;
  filtersVisible: boolean;
  onToggleFilters: () => void;
}

type CopyStatus = 'idle' | 'ok' | 'fail';

const STATUS_RESET_MS = 1500;

export const ChangeLogHeader = observer(
  ({ uiStore, exporter, styleEdit, filtersVisible, onToggleFilters }: ChangeLogHeaderProps) => {
    const portal = usePortalContainer();
    const [copyStatus, setCopyStatus] = React.useState<CopyStatus>('idle');

    React.useEffect(() => {
      if (copyStatus === 'idle') return;
      const id = window.setTimeout(() => setCopyStatus('idle'), STATUS_RESET_MS);
      return () => window.clearTimeout(id);
    }, [copyStatus]);

    const handleResetAll = React.useCallback(() => {
      styleEdit.reset();
    }, [styleEdit]);

    const handleExport = React.useCallback(async () => {
      try {
        const ok = await exporter.copyToClipboard(undefined, portal);
        setCopyStatus(ok ? 'ok' : 'fail');
      } catch (err) {
        console.warn('[paperx/ChangeLogHeader] export failed', err);
        setCopyStatus('fail');
      }
    }, [exporter, portal]);

    const total = uiStore.totalCount;
    const filtered = uiStore.filteredRecords.length;
    const filterActive = uiStore.hasActiveFilter;
    const drawerOpen = uiStore.drawerOpen;
    const cap = filtered >= 200 && !filterActive;

    return (
      <header
        className="flex items-center gap-2 border-b bg-background/95 px-3 py-1.5"
        role="heading"
        aria-level={2}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => uiStore.toggleDrawer()}
          aria-label={drawerOpen ? 'Collapse change log' : 'Expand change log'}
          title={drawerOpen ? 'Collapse' : 'Expand'}
          className="h-6 w-6 shrink-0"
        >
          {drawerOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </Button>
        <span className="text-[11px] font-semibold uppercase tracking-wide">Change log</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {filterActive ? `${filtered} / ${total}` : total}
          {cap ? ' (cap 200)' : ''}
        </span>

        <span className="flex-1" />

        <Button
          variant={filtersVisible ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onToggleFilters}
          aria-pressed={filtersVisible}
          title="Toggle filters"
          className={cn('h-7 px-2', filterActive && 'text-amber-600')}
        >
          <Filter className="mr-1 h-3 w-3" />
          Filters
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetAll}
          disabled={total === 0}
          title="Revert all changes and clear the log"
          className="h-7 px-2"
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Reset
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleExport}
          disabled={total === 0}
          title="Build paperx-prompt-v1 and copy to clipboard"
          className="h-7 px-2"
        >
          {copyStatus === 'ok' ? (
            <Check className="mr-1 h-3 w-3" />
          ) : copyStatus === 'fail' ? (
            <AlertTriangle className="mr-1 h-3 w-3" />
          ) : (
            <ClipboardCopy className="mr-1 h-3 w-3" />
          )}
          {copyStatus === 'ok' ? 'Copied' : copyStatus === 'fail' ? 'Failed' : 'Export Prompt'}
        </Button>
      </header>
    );
  },
);
ChangeLogHeader.displayName = 'ChangeLogHeader';
