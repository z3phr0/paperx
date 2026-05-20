/**
 * shadcn-style Input — manually authored to live inside Shadow DOM.
 *
 * Variants are deliberately minimal; design panel sections drive their
 * own layout via Label/Input pairs.
 */
import * as React from 'react';

import { cn } from './utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-7 w-full rounded-sm border border-input bg-background px-2 py-1 text-xs',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
