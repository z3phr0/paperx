/**
 * Segmented — a single-select pill picker built on `@radix-ui/react-toggle-group`.
 *
 * Generic over the value type so callers can supply a string-literal
 * union (e.g. `'px' | '%' | 'rem'`) and get exhaustive type checking
 * back through `onChange`.
 */
import * as React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';

import { cn } from './utils';

export interface SegmentedOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  ariaLabel?: string;
}

export interface SegmentedProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<SegmentedOption<V>>;
  disabled?: boolean;
  className?: string;
}

export function Segmented<V extends string = string>({
  value,
  onChange,
  options,
  disabled,
  className,
}: SegmentedProps<V>): React.ReactElement {
  const handleValueChange = React.useCallback(
    (next: string) => {
      // Radix fires '' when the user presses the active item (deselect);
      // controlled single-select should ignore empty to stay sticky.
      if (!next) return;
      onChange(next as V);
    },
    [onChange],
  );

  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={handleValueChange}
      disabled={disabled}
      data-testid="paperx-segmented"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-input bg-secondary p-0.5',
        'data-[disabled]:opacity-50',
        className,
      )}
    >
      {options.map((opt) => (
        <ToggleGroup.Item
          key={opt.value}
          value={opt.value}
          aria-label={opt.ariaLabel}
          data-testid={`paperx-segmented-option-${opt.value}`}
          className={cn(
            'inline-flex h-7 min-w-[28px] items-center justify-center rounded-sm px-2 text-xs font-medium',
            'text-muted-foreground transition-colors',
            'hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50',
            'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm',
          )}
        >
          {opt.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

Segmented.displayName = 'Segmented';
