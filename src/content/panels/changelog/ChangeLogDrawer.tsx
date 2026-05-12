/**
 * ChangeLogDrawer — bottom-of-viewport floating drawer that surfaces the
 * paperx ChangeLog (filterable, locatable, undoable) and the JSON Prompt
 * exporter.
 *
 * Visibility: rendered only when `uiStore.visible === true`. Open vs.
 * collapsed state lives in ChangeLogUIStore.drawerOpen.
 *
 * Layout strategy:
 *   - left/right margin 16 px, bottom 16 px
 *   - height: 280 px when expanded, 40 px when collapsed (header only)
 *   - z-index 2147483645: just below DesignPanel (2147483646) and the
 *     toolbar pill (max int32). When DesignPanel is visible AND
 *     overlapping geometrically (right side, full height), we shrink
 *     the drawer's right margin so the two surfaces don't fight for the
 *     same pixels.
 *   - the drawer itself stops mouse + keyboard events bubbling, so the
 *     ElementPicker capture-phase listener doesn't hijack input events.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { ChangeLogUIStore } from '@/shared/stores/ChangeLogUIStore';
import type { IJsonPromptExporter } from '@/shared/services/JsonPromptExporter';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

import { ChangeLogHeader } from './ChangeLogHeader';
import { ChangeLogFilters } from './ChangeLogFilters';
import { ChangeLogRow } from './ChangeLogRow';

const COLLAPSED_HEIGHT = 40;
const EXPANDED_HEIGHT = 280;
const SIDE_PANEL_WIDTH = 400;
const PANEL_GUTTER = 8;
const SIDE_PANEL_MODES: ReadonlySet<string> = new Set([
  'design',
  'ruler',
  'comment',
  'transition',
]);

export interface ChangeLogDrawerProps {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  changeLogUIStore: ChangeLogUIStore;
  exporter: IJsonPromptExporter;
  styleEdit: IStyleEditService;
}

export const ChangeLogDrawer = observer(
  ({
    uiStore,
    selectionStore,
    changeLogUIStore,
    exporter,
    styleEdit,
  }: ChangeLogDrawerProps) => {
    const [filtersVisible, setFiltersVisible] = React.useState(false);

    if (!uiStore.visible) return null;

    const isOpen = changeLogUIStore.drawerOpen;
    const records = changeLogUIStore.filteredRecords;

    const sidePanelVisible =
      uiStore.mode != null &&
      SIDE_PANEL_MODES.has(uiStore.mode) &&
      selectionStore.selected != null;
    const rightOffset = sidePanelVisible
      ? 16 + SIDE_PANEL_WIDTH + PANEL_GUTTER
      : 16;

    const containerStyle: React.CSSProperties = {
      position: 'fixed',
      left: 16,
      right: rightOffset,
      bottom: 16,
      height: isOpen ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
      zIndex: 2147483645,
    };

    return (
      <div
        role="region"
        aria-label="paperx change log"
        style={containerStyle}
        className="paperx-surface flex flex-col overflow-hidden rounded-lg"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <ChangeLogHeader
          uiStore={changeLogUIStore}
          exporter={exporter}
          styleEdit={styleEdit}
          filtersVisible={filtersVisible && isOpen}
          onToggleFilters={() => setFiltersVisible((v) => !v)}
        />
        {isOpen && filtersVisible && <ChangeLogFilters uiStore={changeLogUIStore} />}
        {isOpen && (
          <div
            role="grid"
            aria-label="ChangeLog records"
            className="flex-1 overflow-y-auto px-1 py-1"
          >
            {records.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                {changeLogUIStore.totalCount === 0
                  ? 'No edits yet — pick an element and tweak a style.'
                  : 'No records match the current filter.'}
              </div>
            ) : (
              records.map((r) => (
                <ChangeLogRow
                  key={r.id}
                  record={r}
                  styleEdit={styleEdit}
                  uiStore={changeLogUIStore}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  },
);
ChangeLogDrawer.displayName = 'ChangeLogDrawer';
