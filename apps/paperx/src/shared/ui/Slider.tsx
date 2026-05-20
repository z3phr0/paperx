/**
 * Slider — controlled wrapper around `@radix-ui/react-slider` with a
 * preview/commit split that mirrors `ColorPicker`.
 *
 * Drag interaction → `onPreview` (every value change). The parent should
 * mutate the live element directly during preview but NOT write to
 * ChangeLog. On pointer release, Radix fires `onValueCommit` which we
 * forward to `onChange`; that's where the parent should call
 * `StyleEditService.apply` so ChangeLog gets exactly one record per drag.
 */
import * as React from 'react';
import * as RadixSlider from '@radix-ui/react-slider';

import { cn } from './utils';

export interface SliderProps {
  value: number;
  /** Commit on release — parent should write to ChangeLog here. */
  onChange?: (value: number) => void;
  /** Live drag — fires every value change. Parent previews only, no ChangeLog write. */
  onPreview?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export const Slider = React.forwardRef<HTMLSpanElement, SliderProps>(
  (
    {
      value,
      onChange,
      onPreview,
      min = 0,
      max = 100,
      step = 1,
      disabled,
      ariaLabel,
      className,
      ...props
    },
    ref,
  ) => {
    const handleValueChange = React.useCallback(
      (next: number[]) => {
        const v = next[0];
        if (typeof v === 'number') onPreview?.(v);
      },
      [onPreview],
    );

    const handleValueCommit = React.useCallback(
      (next: number[]) => {
        const v = next[0];
        if (typeof v === 'number') onChange?.(v);
      },
      [onChange],
    );

    return (
      <RadixSlider.Root
        ref={ref}
        data-testid="paperx-slider"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
        className={cn(
          'relative flex h-5 w-full touch-none select-none items-center',
          'data-[disabled]:opacity-50',
          className,
        )}
        {...props}
      >
        <RadixSlider.Track
          className={cn(
            'relative h-1 w-full grow overflow-hidden rounded-full bg-secondary',
          )}
        >
          <RadixSlider.Range className="absolute h-full bg-primary" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-label={ariaLabel}
          className={cn(
            'block h-4 w-4 rounded-full border border-input bg-background shadow',
            'transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        />
      </RadixSlider.Root>
    );
  },
);
Slider.displayName = 'Slider';
