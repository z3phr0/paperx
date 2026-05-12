/**
 * Segmented — pill-style multi-option toggle. Matches `.dv-segmented`
 * + `.dv-seg-item` from design-v2.css.
 */
import * as React from 'react';

export interface SegmentedItem<V extends string> {
  value: V;
  icon?: React.ReactNode;
  label?: React.ReactNode;
  title?: string;
}

export interface SegmentedProps<V extends string> {
  value: V;
  onChange?: (next: V) => void;
  items: ReadonlyArray<SegmentedItem<V>>;
  /** Stretch to fill the parent row. */
  full?: boolean;
  /** Active item uses the accent color instead of plain text. */
  accentActive?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function Segmented<V extends string>({
  value,
  onChange,
  items,
  full = false,
  accentActive = false,
  className,
  ...rest
}: SegmentedProps<V>): React.ReactElement {
  return (
    <div
      className={`dv-segmented${full ? ' dv-full' : ''}${className ? ` ${className}` : ''}`}
      data-testid={rest['data-testid']}
    >
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          className="dv-seg-item"
          data-active={value === it.value}
          data-accent={accentActive ? true : undefined}
          onClick={() => onChange?.(it.value)}
          title={it.title ?? (typeof it.label === 'string' ? it.label : undefined)}
        >
          {it.icon ?? it.label}
        </button>
      ))}
    </div>
  );
}
