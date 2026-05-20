/**
 * Border editor logic — shared between the legacy DesignPanel and
 * design-v2. Keeps the entry model, side mutual-exclusion rule, color
 * normalization, and commit-on-change strategy in one place so visual
 * rewrites never drift from the behavior the existing e2e suite locks in.
 *
 * Pure helpers (propsFor / cssColorToHex8 / deriveEntriesFromTarget /
 * deriveGlobalStyle) plus the stateful `useBorderEditor` hook.
 */
import * as React from 'react';

import type { IStyleEditService } from '@/shared/services/StyleEditService';

export type BorderSide = 'all' | 'top' | 'right' | 'bottom' | 'left';
export type BorderStyle = 'solid' | 'dashed' | 'dotted';

export interface BorderEntry {
  id: string;
  side: BorderSide;
  width: number;
  /** 8-char hex, e.g. `#ff0000ff`. Single canonical format throughout. */
  color: string;
  visible: boolean;
}

export const SIDE_OPTIONS: ReadonlyArray<{ value: BorderSide; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

export const PER_SIDE_ORDER: ReadonlyArray<BorderSide> = [
  'top',
  'right',
  'bottom',
  'left',
];

export const STYLE_OPTIONS: ReadonlyArray<BorderStyle> = ['solid', 'dashed', 'dotted'];

export const DEFAULT_COLOR = '#000000ff';

let _seq = 0;
const newId = (): string => `b-${(_seq++).toString(36)}`;

export function propsFor(side: BorderSide): {
  width: string;
  style: string;
  color: string;
} {
  if (side === 'all') {
    return { width: 'border-width', style: 'border-style', color: 'border-color' };
  }
  return {
    width: `border-${side}-width`,
    style: `border-${side}-style`,
    color: `border-${side}-color`,
  };
}

/**
 * Convert a CSS color string (typically `rgb(...)` / `rgba(...)` from
 * getComputedStyle or `#hex8` already from inline style) to an 8-char
 * hex string so the entry model stays single-format.
 */
export function cssColorToHex8(raw: string): string {
  if (!raw) return '#000000ff';
  const trimmed = raw.trim();
  if (/^#[0-9a-f]{8}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return `${trimmed.toLowerCase()}ff`;
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(
    trimmed,
  );
  if (m) {
    const hex2 = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    const a = m[4] != null ? Number(m[4]) : 1;
    return `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(Math.round(a * 255))}`;
  }
  return '#000000ff';
}

/**
 * Derive editor entries from the target element's inline style. We read
 * inline (not computed) so an explicit per-side longhand the user set
 * always wins over UA-default values; "nothing touched yet" gives an
 * empty array (the empty state).
 */
export function deriveEntriesFromTarget(target: HTMLElement): BorderEntry[] {
  const s = target.style;
  const allWidth = s.borderWidth;
  const allStyle = s.borderStyle;
  const allColor = s.borderColor;
  const hasAnyShorthand = !!(allWidth || allStyle || allColor);

  if (hasAnyShorthand) {
    return [
      {
        id: newId(),
        side: 'all',
        width: parseInt(allWidth || '0', 10) || 0,
        color: cssColorToHex8(allColor || '#000000ff'),
        visible: allStyle !== 'none',
      },
    ];
  }

  const entries: BorderEntry[] = [];
  const cap = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
  for (const side of PER_SIDE_ORDER) {
    const w = (target.style as unknown as Record<string, string>)[
      `border${cap(side)}Width`
    ];
    const st = (target.style as unknown as Record<string, string>)[
      `border${cap(side)}Style`
    ];
    const col = (target.style as unknown as Record<string, string>)[
      `border${cap(side)}Color`
    ];
    if (!w && !st && !col) continue;
    entries.push({
      id: newId(),
      side,
      width: parseInt(w || '0', 10) || 0,
      color: cssColorToHex8(col || '#000000ff'),
      visible: st !== 'none',
    });
  }
  return entries;
}

/**
 * Derive the global style picker from inline style. Falls back to
 * 'solid' when no style is recorded yet.
 */
export function deriveGlobalStyle(target: HTMLElement): BorderStyle {
  const s = target.style;
  const candidates = [
    s.borderStyle,
    s.borderTopStyle,
    s.borderRightStyle,
    s.borderBottomStyle,
    s.borderLeftStyle,
  ];
  for (const v of candidates) {
    if (v === 'solid' || v === 'dashed' || v === 'dotted') return v;
  }
  return 'solid';
}

export interface UseBorderEditorArgs {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export interface UseBorderEditor {
  entries: BorderEntry[];
  globalStyle: BorderStyle;
  usedSides: Set<BorderSide>;
  hasAll: boolean;
  canAdd: boolean;
  handleAdd: () => void;
  handleChangeSide: (id: string, next: BorderSide) => void;
  handleChangeWidth: (id: string, width: number) => void;
  handleChangeColor: (id: string, color: string) => void;
  handlePreviewColor: (id: string, color: string) => void;
  handleToggleVisible: (id: string) => void;
  handleRemove: (id: string) => void;
  handleSetStyle: (style: BorderStyle) => void;
}

export function useBorderEditor({
  target,
  styleEdit,
}: UseBorderEditorArgs): UseBorderEditor {
  const [entries, setEntries] = React.useState<BorderEntry[]>(() =>
    deriveEntriesFromTarget(target),
  );
  const [globalStyle, setGlobalStyle] = React.useState<BorderStyle>(() =>
    deriveGlobalStyle(target),
  );

  React.useEffect(() => {
    setEntries(deriveEntriesFromTarget(target));
    setGlobalStyle(deriveGlobalStyle(target));
  }, [target]);

  const usedSides: Set<BorderSide> = React.useMemo(
    () => new Set(entries.map((e) => e.side)),
    [entries],
  );
  const hasAll = usedSides.has('all');
  const canAdd = !hasAll && entries.length < 4;

  const writeEntry = React.useCallback(
    (entry: BorderEntry, style: BorderStyle) => {
      const p = propsFor(entry.side);
      styleEdit.apply(target, p.width, `${entry.width}px`);
      styleEdit.apply(target, p.style, entry.visible ? style : 'none');
      styleEdit.apply(target, p.color, entry.color);
    },
    [target, styleEdit],
  );

  const clearSide = React.useCallback(
    (side: BorderSide) => {
      const p = propsFor(side);
      styleEdit.apply(target, p.width, '');
      styleEdit.apply(target, p.style, '');
      styleEdit.apply(target, p.color, '');
    },
    [target, styleEdit],
  );

  const handleAdd = React.useCallback(() => {
    if (!canAdd) return;
    let next: BorderSide;
    if (entries.length === 0) {
      next = 'all';
    } else {
      const free = PER_SIDE_ORDER.find((s) => !usedSides.has(s));
      if (!free) return;
      next = free;
    }
    const entry: BorderEntry = {
      id: newId(),
      side: next,
      width: 1,
      color: DEFAULT_COLOR,
      visible: true,
    };
    setEntries((prev) => [...prev, entry]);
    writeEntry(entry, globalStyle);
  }, [canAdd, entries.length, usedSides, writeEntry, globalStyle]);

  const handleChangeSide = React.useCallback(
    (id: string, next: BorderSide) => {
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === id);
        if (idx < 0) return prev;
        const current = prev[idx]!;
        if (current.side === next) return prev;
        if (prev.some((e) => e.id !== id && e.side === next)) return prev;

        if (next === 'all') {
          for (const e of prev) {
            if (e.id !== id) clearSide(e.side);
          }
          clearSide(current.side);
          const updated: BorderEntry = { ...current, side: 'all' };
          writeEntry(updated, globalStyle);
          return [updated];
        }

        clearSide(current.side);
        const updated: BorderEntry = { ...current, side: next };
        writeEntry(updated, globalStyle);
        return prev.map((e) => (e.id === id ? updated : e));
      });
    },
    [clearSide, writeEntry, globalStyle],
  );

  const handleChangeWidth = React.useCallback(
    (id: string, width: number) => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, width } : e));
        const entry = next.find((e) => e.id === id);
        if (entry) writeEntry(entry, globalStyle);
        return next;
      });
    },
    [writeEntry, globalStyle],
  );

  const handleChangeColor = React.useCallback(
    (id: string, color: string) => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, color } : e));
        const entry = next.find((e) => e.id === id);
        if (entry) writeEntry(entry, globalStyle);
        return next;
      });
    },
    [writeEntry, globalStyle],
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
        if (entry) writeEntry(entry, globalStyle);
        return next;
      });
    },
    [writeEntry, globalStyle],
  );

  const handleRemove = React.useCallback(
    (id: string) => {
      const found = entries.find((e) => e.id === id);
      if (found) clearSide(found.side);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    [entries, clearSide],
  );

  const handleSetStyle = React.useCallback(
    (style: BorderStyle) => {
      setGlobalStyle(style);
      for (const entry of entries) writeEntry(entry, style);
    },
    [entries, writeEntry],
  );

  return {
    entries,
    globalStyle,
    usedSides,
    hasAll,
    canAdd,
    handleAdd,
    handleChangeSide,
    handleChangeWidth,
    handleChangeColor,
    handlePreviewColor,
    handleToggleVisible,
    handleRemove,
    handleSetStyle,
  };
}
