/**
 * Radius editor logic — shared between the legacy DesignPanel and
 * design-v2. Encapsulates the per-corner state, unified/per-corner mode
 * toggle, enable-on-add gating, and commit-on-change strategy.
 */
import * as React from 'react';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { pxToInt, formatLengthPx } from '@/shared/types/numeric';

export type Corner = 'tl' | 'tr' | 'br' | 'bl';
export type RadiusMode = 'unified' | 'per-corner';

export const CORNERS: ReadonlyArray<Corner> = ['tl', 'tr', 'br', 'bl'];

export const CORNER_TO_PROP: Record<Corner, string> = {
  tl: 'border-top-left-radius',
  tr: 'border-top-right-radius',
  br: 'border-bottom-right-radius',
  bl: 'border-bottom-left-radius',
};

export const SLIDER_MAX = 64;
export const DEFAULT_RADIUS_PX = '8';

export function read(target: HTMLElement, prop: string): string {
  try {
    return (getComputedStyle(target).getPropertyValue(prop) ?? '').trim();
  } catch {
    return '';
  }
}

export function broadcastAll(
  target: HTMLElement,
  styleEdit: IStyleEditService,
  value: string,
): void {
  for (const c of CORNERS) styleEdit.apply(target, CORNER_TO_PROP[c], value);
}

export interface UseRadiusEditorArgs {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export interface UseRadiusEditor {
  radius: Record<Corner, string>;
  mode: RadiusMode;
  setMode: React.Dispatch<React.SetStateAction<RadiusMode>>;
  enabled: boolean;
  /** When all four corners agree the unified field shows that value; else blank. */
  unifiedValue: string;
  /** Numeric form of `unifiedValue` clamped to slider range; 0 when blank. */
  unifiedNumber: number;
  commitUnified: (raw: string) => void;
  commitCorner: (corner: Corner, raw: string) => void;
}

export function useRadiusEditor({
  target,
  styleEdit,
}: UseRadiusEditorArgs): UseRadiusEditor {
  const seed = React.useMemo(() => {
    const out: Record<Corner, string> = { tl: '', tr: '', br: '', bl: '' };
    for (const c of CORNERS) out[c] = pxToInt(read(target, CORNER_TO_PROP[c]));
    return out;
  }, [target]);

  const [radius, setRadius] = React.useState<Record<Corner, string>>(seed);
  const [mode, setMode] = React.useState<RadiusMode>('unified');

  React.useEffect(() => setRadius(seed), [seed]);

  const allEqual =
    radius.tl !== '' &&
    radius.tl === radius.tr &&
    radius.tr === radius.br &&
    radius.br === radius.bl;
  const unifiedValue = allEqual ? radius.tl : '';
  const unifiedNumber =
    unifiedValue === ''
      ? 0
      : Math.min(SLIDER_MAX, Number(unifiedValue) || 0);

  const enabled = CORNERS.some((c) => {
    const v = radius[c];
    return v !== '' && Number(v) > 0;
  });

  const commitUnified = React.useCallback(
    (raw: string) => {
      setRadius({ tl: raw, tr: raw, br: raw, bl: raw });
      if (raw.trim() === '') return;
      const formatted = formatLengthPx(raw, { allowNegative: false });
      if (formatted == null) return;
      broadcastAll(target, styleEdit, formatted);
    },
    [target, styleEdit],
  );

  const commitCorner = React.useCallback(
    (corner: Corner, raw: string) => {
      setRadius((prev) => ({ ...prev, [corner]: raw }));
      if (raw.trim() === '') return;
      const formatted = formatLengthPx(raw, { allowNegative: false });
      if (formatted == null) return;
      styleEdit.apply(target, CORNER_TO_PROP[corner], formatted);
    },
    [target, styleEdit],
  );

  return {
    radius,
    mode,
    setMode,
    enabled,
    unifiedValue,
    unifiedNumber,
    commitUnified,
    commitCorner,
  };
}
