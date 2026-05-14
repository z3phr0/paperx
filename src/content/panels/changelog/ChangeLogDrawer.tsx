/**
 * ChangeLogDrawer — bottom-of-viewport floating drawer that surfaces the
 * paperx ChangeLog (filterable, locatable, undoable) and the JSON Prompt
 * exporter.
 *
 * Visibility: rendered only when `uiStore.visible === true`. Open vs.
 * collapsed state lives in ChangeLogUIStore.drawerOpen.
 *
 * Layout strategy:
 *   - left/right margin 16 px, bottom 16 px (full viewport width minus
 *     the gutter — v0.11.8 stopped letting side panels push the drawer
 *     into a half-width strip)
 *   - height: 280 px when expanded, 40 px when collapsed (header only)
 *   - z-index 2147483645: just below DesignPanel (2147483646) and the
 *     toolbar pill (max int32). DesignPanel overlaps the drawer's right
 *     edge by design; it sits on top so both surfaces can coexist.
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
    changeLogUIStore,
    exporter,
    styleEdit,
  }: ChangeLogDrawerProps) => {
    const [filtersVisible, setFiltersVisible] = React.useState(false);

    if (!uiStore.visible) return null;

    const isOpen = changeLogUIStore.drawerOpen;
    const records = changeLogUIStore.filteredRecords;

    const containerStyle: React.CSSProperties = {
      position: 'fixed',
      left: 16,
      right: 16,
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
