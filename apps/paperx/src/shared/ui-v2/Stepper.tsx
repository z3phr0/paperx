/**
 * Stepper — minus / plus pair sharing a single pill, matching
 * `.dv-stepper` from design-v2.css.
 */
import * as React from 'react';

import { Icon } from './Icon';

export interface StepperProps {
  value: number;
  onChange?: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
}: StepperProps): React.ReactElement {
  const clamp = (n: number): number => Math.max(min, Math.min(max, n));
  return (
    <div className="dv-stepper">
      <button
        type="button"
        className="dv-stepper-btn"
        onClick={() => onChange?.(clamp(value - step))}
        aria-label="Decrement"
      >
        <Icon name="minus" size={11} />
      </button>
      <div className="dv-stepper-divider" />
      <button
        type="button"
        className="dv-stepper-btn"
        onClick={() => onChange?.(clamp(value + step))}
        aria-label="Increment"
      >
        <Icon name="plus" size={11} />
      </button>
    </div>
  );
}
