/**
 * AlignButtons — left / center / right text-or-box alignment cluster.
 * Composes <IconButton> internally with lucide-react glyphs. The `value`
 * prop accepts `null` so callers can render an indeterminate state when
 * the underlying selection has mixed alignment.
 */
import * as React from 'react';
import { AlignCenter, AlignLeft, AlignRight, type LucideIcon } from 'lucide-react';

import { IconButton } from './IconButton';
import { cn } from './utils';

export type AlignValue = 'left' | 'center' | 'right';

export interface AlignButtonsProps {
  value: AlignValue | null;
  onChange: (value: AlignValue) => void;
  disabled?: boolean;
  className?: string;
}

interface Entry {
  value: AlignValue;
  Icon: LucideIcon;
  ariaLabel: string;
  testId: string;
}

const ENTRIES: ReadonlyArray<Entry> = [
  { value: 'left', Icon: AlignLeft, ariaLabel: 'Align left', testId: 'paperx-align-left' },
  { value: 'center', Icon: AlignCenter, ariaLabel: 'Align center', testId: 'paperx-align-center' },
  { value: 'right', Icon: AlignRight, ariaLabel: 'Align right', testId: 'paperx-align-right' },
];

export function AlignButtons({
  value,
  onChange,
  disabled,
  className,
}: AlignButtonsProps): React.ReactElement {
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {ENTRIES.map(({ value: v, Icon, ariaLabel, testId }) => (
        <IconButton
          key={v}
          ariaLabel={ariaLabel}
          active={value === v}
          disabled={disabled}
          data-testid={testId}
          onClick={() => onChange(v)}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </IconButton>
      ))}
    </div>
  );
}

AlignButtons.displayName = 'AlignButtons';
