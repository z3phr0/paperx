/**
 * IconButton — square action button keyed to `.dv-icon-btn` from design-v2.
 * `icon` is either an IconName (rendered via the Icon component) or any
 * React node so the call site can pass custom SVG.
 *
 * Wrapped in `React.forwardRef` so Radix Slot patterns (`Popover.Trigger
 * asChild`, `DropdownMenu.Trigger asChild`, …) can attach the floating
 * anchor ref to the underlying <button>. Without forwardRef the ref is
 * silently dropped and the popper has no rect to position against.
 */
import * as React from 'react';

import { Icon, type IconName } from './Icon';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName | React.ReactNode;
  size?: 'sm' | 'md';
  active?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, size = 'sm', active, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={`dv-icon-btn${size === 'md' ? ' dv-size-md' : ''}${className ? ` ${className}` : ''}`}
        data-active={active || undefined}
        {...rest}
      >
        {typeof icon === 'string' ? <Icon name={icon as IconName} /> : icon}
      </button>
    );
  },
);
