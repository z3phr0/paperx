/**
 * Section — labeled vertical container that owns the top-left title and
 * top-right action slot. Matches `.dv-section` from design-v2.css.
 */
import * as React from 'react';

export interface SectionProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function Section({
  title,
  actions,
  children,
  className,
  ...rest
}: SectionProps): React.ReactElement {
  return (
    <div
      className={`dv-section${className ? ` ${className}` : ''}`}
      data-testid={rest['data-testid']}
    >
      <div className="dv-section-header">
        <div className="dv-section-title">{title}</div>
        {actions && <div className="dv-section-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
