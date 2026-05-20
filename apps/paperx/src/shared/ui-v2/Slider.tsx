/**
 * Slider — minimal pointer-drag slider matching `.dv-slider` from
 * design-v2.css. Used for Radius / Opacity / Perspective rows.
 *
 * Mouse + touch drag both fire `onPreview` continuously and `onChange`
 * on release — same preview-vs-commit split as the legacy Slider in
 * `@/shared/ui/Slider`, so design-logic hooks can use either backend
 * interchangeably.
 */
import * as React from 'react';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onPreview?: (value: number) => void;
  onChange?: (value: number) => void;
  ariaLabel?: string;
  className?: string;
  'data-testid'?: string;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onPreview,
  onChange,
  ariaLabel,
  className,
  ...rest
}: SliderProps): React.ReactElement {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const lastRef = React.useRef<number>(value);

  const clamp = (raw: number): number => {
    const stepped = Math.round((raw - min) / step) * step + min;
    return Math.max(min, Math.min(max, stepped));
  };

  const pct = ((value - min) / (max - min)) * 100;

  const compute = React.useCallback(
    (clientX: number): number | null => {
      const track = trackRef.current;
      if (!track) return null;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const ratio = (clientX - rect.left) / rect.width;
      return clamp(min + Math.max(0, Math.min(1, ratio)) * (max - min));
    },
    [min, max, step], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const initial = compute(e.clientX);
    if (initial != null) {
      onPreview?.(initial);
      lastRef.current = initial;
    }
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const next = compute(ev.clientX);
      if (next != null && next !== lastRef.current) {
        onPreview?.(next);
        lastRef.current = next;
      }
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      onChange?.(lastRef.current);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      ref={trackRef}
      className={`dv-slider${className ? ` ${className}` : ''}`}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onPointerDown}
      data-testid={rest['data-testid']}
    >
      <div className="dv-slider-fill" style={{ width: `${pct}%` }} />
      <div className="dv-slider-thumb" style={{ left: `${pct}%` }} />
    </div>
  );
}
