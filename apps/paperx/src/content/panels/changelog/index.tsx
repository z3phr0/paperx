/**
 * Barrel for the change-log panel.
 *
 * `<ChangeLog />` is the convenience wrapper that resolves all DI
 * dependencies (SelectionStore, ChangeLogUIStore, JsonPromptExporter,
 * StyleEditService) from the singleton container so the FloatingToolbar
 * mount site only needs to pass through `uiStore`. We keep the lower-
 * level `<ChangeLogDrawer />` exported too in case a future test
 * harness wants to inject mocks.
 */
import * as React from 'react';

import { getContainer } from '@/shared/di/container';
import { TYPES } from '@/shared/di/tokens';
import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { ChangeLogUIStore } from '@/shared/stores/ChangeLogUIStore';
import type { IJsonPromptExporter } from '@/shared/services/JsonPromptExporter';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

import { ChangeLogDrawer } from './ChangeLogDrawer';

export { ChangeLogDrawer } from './ChangeLogDrawer';
export { ChangeLogHeader } from './ChangeLogHeader';
export { ChangeLogFilters } from './ChangeLogFilters';
export { ChangeLogRow } from './ChangeLogRow';

export interface ChangeLogProps {
  uiStore: UIStore;
}

export function ChangeLog({ uiStore }: ChangeLogProps): React.ReactElement {
  const container = getContainer();
  const selectionStore = container.get<SelectionStore>(TYPES.SelectionStore);
  const changeLogUIStore = container.get<ChangeLogUIStore>(TYPES.ChangeLogUIStore);
  const exporter = container.get<IJsonPromptExporter>(TYPES.JsonPromptExporter);
  const styleEdit = container.get<IStyleEditService>(TYPES.StyleEditService);
  return (
    <ChangeLogDrawer
      uiStore={uiStore}
      selectionStore={selectionStore}
      changeLogUIStore={changeLogUIStore}
      exporter={exporter}
      styleEdit={styleEdit}
    />
  );
}

export default ChangeLog;
