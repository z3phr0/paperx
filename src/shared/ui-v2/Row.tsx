/**
 * Row — label + content layout used inside a Section. Matches `.dv-row`
 * from design-v2.css.
 */
import * as React from 'react';

export interface RowProps {
  label?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function Row({ label, children, className }: RowProps): React.ReactElement {
  return (
    <div className={`dv-row${className ? ` ${className}` : ''}`}>
      {label != null && <div className="dv-row-label">{label}</div>}
      <div className="dv-row-content">{children}</div>
    </div>
  );
}
