/**
 * shadcn-style Card — minimal container for design panel sections.
 *
 * Sections are collapsible: the parent passes `<CardHeader onClick>` to
 * toggle, and conditionally renders `<CardContent>`. We don't bake the
 * collapse state in here to keep the primitive dumb.
 */
import * as React from 'react';

import { cn } from './utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-md border bg-background',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide',
      className,
    )}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1.5 px-2.5 pb-2.5 pt-0.5', className)}
    {...props}
  />
));
CardContent.displayName = 'CardContent';
