/**
 * Swatch — color sample square with an optional checkered backdrop for
 * sub-opaque alpha. Matches `.dv-swatch` from design-v2.css.
 */
import * as React from 'react';

export interface SwatchProps {
  color: string;
  /** 0..1 — when below 1, the checker pattern shows through. */
  alpha?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Swatch({
  color,
  alpha = 1,
  className,
  style,
}: SwatchProps): React.ReactElement {
  const checkered =
    'repeating-conic-gradient(#999 0% 25%, #ccc 0% 50%) 50% / 4px 4px';
  const overlay =
    alpha < 1
      ? `linear-gradient(to right, ${color} 0%, ${color} 50%, transparent 50%, transparent 100%), ${checkered}`
      : color;
  return (
    <div
      className={`dv-swatch${className ? ` ${className}` : ''}`}
      style={{ background: overlay, ...style }}
    />
  );
}
