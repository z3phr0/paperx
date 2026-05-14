/**
 * Fill editor logic — design-v2 Fill section's single-entry editor.
 *
 * Scope for v0.11.0: solid only, one fill entry per element. Mirrors the
 * shape of `useBorderEditor` so the Fill section reads identically (entry
 * model, preview/commit split, ChangeLog routing). Gradient / Image tabs
 * are visual shells without a write path this period.
 */
import * as React from 'react';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { cssColorToHex8 } from './border';

export interface FillEntry {
  id: string;
  /** 8-char hex, e.g. `#ffffffff`. */
  color: string;
  visible: boolean;
}

export const DEFAULT_FILL_COLOR = '#ffffffff';

let _seq = 0;
const newId = (): string => `f-${(_seq++).toString(36)}`;

export function hex8ToRgba(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1]!, 16);
  const g = parseInt(m[2]!, 16);
  const b = parseInt(m[3]!, 16);
  const a = parseInt(m[4]!, 16) / 255;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

/**
 * Derive the (single) fill entry from the target's inline style.
 * Empty / transparent / unset inline background-color → no entry, so the
 * section starts collapsed for a fresh element and the user materialises
 * the fill by clicking +.
 */
export function deriveFillEntries(target: HTMLElement): FillEntry[] {
  const inline = target.style.backgroundColor;
  if (!inline) return [];
  if (inline === 'transparent') return [];
  return [
    {
      id: newId(),
      color: cssColorToHex8(inline),
      visible: true,
    },
  ];
}

export interface UseFillEditorArgs {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export interface UseFillEditor {
  entries: FillEntry[];
  canAdd: boolean;
  handleAdd: () => void;
  handleChangeColor: (id: string, color: string) => void;
  handlePreviewColor: (id: string, color: string) => void;
  handleToggleVisible: (id: string) => void;
  handleRemove: (id: string) => void;
}

export function useFillEditor({ target, styleEdit }: UseFillEditorArgs): UseFillEditor {
  const [entries, setEntries] = React.useState<FillEntry[]>(() =>
    deriveFillEntries(target),
  );

  React.useEffect(() => {
    setEntries(deriveFillEntries(target));
  }, [target]);

  const canAdd = entries.length === 0;

  const handleAdd = React.useCallback(() => {
    if (entries.length > 0) return;
    const entry: FillEntry = {
      id: newId(),
      color: DEFAULT_FILL_COLOR,
      visible: true,
    };
    setEntries([entry]);
    styleEdit.apply(target, 'background-color', hex8ToRgba(entry.color));
  }, [entries.length, target, styleEdit]);

  const writeEntry = React.useCallback(
    (entry: FillEntry) => {
      const value = entry.visible ? hex8ToRgba(entry.color) : 'transparent';
      styleEdit.apply(target, 'background-color', value);
    },
    [target, styleEdit],
  );

  const handleChangeColor = React.useCallback(
    (id: string, color: string) => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, color } : e));
        const entry = next.find((e) => e.id === id);
        if (entry) writeEntry(entry);
        return next;
      });
    },
    [writeEntry],
  );

  const handlePreviewColor = React.useCallback(
    (id: string, color: string) => {
      handleChangeColor(id, color);
    },
    [handleChangeColor],
  );

  const handleToggleVisible = React.useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.id === id ? { ...e, visible: !e.visible } : e,
        );
        const entry = next.find((e) => e.id === id);
        if (entry) writeEntry(entry);
        return next;
      });
    },
    [writeEntry],
  );

  const handleRemove = React.useCallback(
    (id: string) => {
      const found = entries.find((e) => e.id === id);
      if (found) styleEdit.apply(target, 'background-color', '');
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    [entries, target, styleEdit],
  );

  return {
    entries,
    canAdd,
    handleAdd,
    handleChangeColor,
    handlePreviewColor,
    handleToggleVisible,
    handleRemove,
  };
}
