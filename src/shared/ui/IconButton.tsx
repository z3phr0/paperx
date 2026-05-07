/**
 * IconButton — square button optimized for icon-only triggers (toolbars,
 * align clusters, mode switches). Two sizes (28 / 32 px) and an `active`
 * boolean that flips into the accent fill and sets `aria-pressed`.
 *
 * Patterned after `button.tsx` but specialized: no asChild slot, required
 * `ariaLabel` (since there's no visible text), and explicit pressed state.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './utils';

const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-md',
    'text-foreground transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      state: {
        idle: 'bg-transparent hover:bg-accent hover:text-accent-foreground',
        active: 'bg-accent text-accent-foreground',
      },
      size: {
        sm: 'h-7 w-7',
        md: 'h-8 w-8',
      },
    },
    defaultVariants: {
      state: 'idle',
      size: 'md',
    },
  },
);

type IconButtonVariantProps = VariantProps<typeof iconButtonVariants>;

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  active?: boolean;
  size?: NonNullable<IconButtonVariantProps['size']>;
  /** Required: icon-only button has no visible text. */
  ariaLabel: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      active,
      size = 'md',
      ariaLabel,
      className,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const state: NonNullable<IconButtonVariantProps['state']> = active
      ? 'active'
      : 'idle';
    const pressed = active === undefined ? undefined : active;
    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        aria-pressed={pressed}
        data-testid="paperx-icon-button"
        className={cn(iconButtonVariants({ state, size }), className)}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';

export { iconButtonVariants };
