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
  /**
   * When true, the section signals its body is empty/disabled and
   * collapsed-state CSS tightens the vertical rhythm (smaller
   * padding-bottom, zero header margin-bottom). Used by Border /
   * Radius for their enable-on-add empty state.
   */
  collapsed?: boolean;
}

export function Section({
  title,
  actions,
  children,
  className,
  collapsed,
  ...rest
}: SectionProps): React.ReactElement {
  return (
    <div
      className={`dv-section${className ? ` ${className}` : ''}`}
      data-testid={rest['data-testid']}
      data-collapsed={collapsed || undefined}
    >
      <div className="dv-section-header">
        <div className="dv-section-title">{title}</div>
        {actions && <div className="dv-section-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
