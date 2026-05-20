/**
 * shadcn-style Label — minimal wrapper to keep typography consistent
 * across panel sections.
 */
import * as React from 'react';

import { cn } from './utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-[11px] font-medium text-muted-foreground',
          className,
        )}
        {...props}
      />
    );
  },
);
Label.displayName = 'Label';
