/**
 * shadcn-style Select — deliberately built on the *native* <select>
 * element rather than @radix-ui/react-select.
 *
 * Why: design-panel options are short enums (display, position,
 * font-family) and a portal-backed Radix Select would (a) require
 * threading `usePortalContainer()` through every render and (b) bring
 * @radix-ui/react-select + popper deps into the content chunk. Native
 * <select> in a Shadow DOM renders fine because the OS popup is its own
 * surface — no portal dance needed.
 *
 * Tradeoff acknowledged: native popups can't be themed. Acceptable for
 * Phase 2; if Figma-level polish is needed later, swap to Radix and
 * thread the portal container.
 */
import * as React from 'react';

import { cn } from './utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-7 w-full rounded-sm border border-input bg-background px-2 text-xs',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  },
);
Select.displayName = 'Select';
