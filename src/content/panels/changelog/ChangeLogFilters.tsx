/**
 * ChangeLogFilters — filter row for the change-log drawer.
 *
 * Three independent inputs (mode dropdown / selector contains / property
 * contains) + a clear-all button. All wired to ChangeLogUIStore.setFilters,
 * which strips empty strings so `hasActiveFilter` stays honest.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { X } from 'lucide-react';

import { Input } from '@/shared/ui/Input';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { Button } from '@/shared/ui/button';
import type { ChangeLogUIStore } from '@/shared/stores/ChangeLogUIStore';
import { TOOL_MODES, TOOL_MODE_LABELS, type ToolMode } from '@/shared/types/modes';

const MODE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All modes' },
  ...TOOL_MODES.map((m) => ({ value: m, label: TOOL_MODE_LABELS[m] })),
];

export interface ChangeLogFiltersProps {
  uiStore: ChangeLogUIStore;
}

export const ChangeLogFilters = observer(({ uiStore }: ChangeLogFiltersProps) => {
  const onMode = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.currentTarget.value;
      uiStore.setFilters({ mode: (v ? (v as ToolMode) : undefined) });
    },
    [uiStore],
  );

  const onSelector = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      uiStore.setFilters({ selectorContains: e.currentTarget.value });
    },
    [uiStore],
  );

  const onProperty = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      uiStore.setFilters({ propertyContains: e.currentTarget.value });
    },
    [uiStore],
  );

  const onClear = React.useCallback(() => {
    uiStore.clearFilters();
  }, [uiStore]);

  return (
    <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5">
      <div className="flex w-32 shrink-0 flex-col gap-0.5">
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          Mode
        </span>
        <Select
          options={MODE_OPTIONS}
          value={uiStore.filters.mode ?? ''}
          onChange={onMode}
          aria-label="Filter by tool mode"
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          Selector contains
        </span>
        <Input
          key={`sel-${uiStore.filters.selectorContains ?? ''}`}
          defaultValue={uiStore.filters.selectorContains ?? ''}
          onChange={onSelector}
          placeholder="div.card"
          aria-label="Filter by selector substring"
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          Property contains
        </span>
        <Input
          key={`prop-${uiStore.filters.propertyContains ?? ''}`}
          defaultValue={uiStore.filters.propertyContains ?? ''}
          onChange={onProperty}
          placeholder="font-size"
          aria-label="Filter by property substring"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        aria-label="Clear filters"
        title="Clear all filters"
        disabled={!uiStore.hasActiveFilter}
        className="mt-3 h-7 shrink-0 px-2"
      >
        <X className="mr-1 h-3 w-3" />
        Clear
      </Button>
    </div>
  );
});
ChangeLogFilters.displayName = 'ChangeLogFilters';
