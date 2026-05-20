/**
 * Checkbox — small checkbox + label row, matching `.dv-checkbox-row` /
 * `.dv-checkbox` from design-v2.css.
 */
import * as React from 'react';

import { Icon } from './Icon';

export interface CheckboxProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label?: React.ReactNode;
}

export function Checkbox({
  checked,
  onChange,
  label,
}: CheckboxProps): React.ReactElement {
  return (
    <div className="dv-checkbox-row" onClick={() => onChange?.(!checked)}>
      <span className="dv-checkbox" data-checked={checked}>
        {checked && <Icon name="check" size={10} />}
      </span>
      {label}
    </div>
  );
}
