/**
 * Border section — multi-row editor (v0.5.0).
 *
 * Each row binds to one side: `all` | `top` | `right` | `bottom` | `left`.
 * Constraints:
 *   - up to 4 rows; side values must be unique
 *   - `all` is mutually exclusive — choosing it collapses every other row
 *     and clears their inline-style longhands
 *   - global style (Solid/Dashed/Dotted) applies to every row
 *
 * Each row writes its side's three longhands (or the `border` shorthand
 * for `all`) through `StyleEditService.apply`, mirroring the BoxModel
 * link UX where every property change is a discrete ChangeLog row.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as Popover from '@radix-ui/react-popover';
import {
  AlignJustify,
  Check,
  Eye,
  EyeOff,
  Minus,
  Plus,
  SlidersHorizontal,
  Square,
} from 'lucide-react';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { ColorPicker } from '@/shared/ui/ColorPicker';
import { cn } from '@/shared/ui/utils';
import { usePortalContainer } from '@/shared/ui/portal';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

type BorderSide = 'all' | 'top' | 'right' | 'bottom' | 'left';
type BorderStyle = 'solid' | 'dashed' | 'dotted';

const SIDE_OPTIONS: ReadonlyArray<{ value: BorderSide; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

const PER_SIDE_ORDER: ReadonlyArray<BorderSide> = ['top', 'right', 'bottom', 'left'];
const STYLE_OPTIONS: ReadonlyArray<BorderStyle> = ['solid', 'dashed', 'dotted'];

interface BorderEntry {
  id: string;
  side: BorderSide;
  width: number;
  color: string;   // hex8
  visible: boolean;
}

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

let _seq = 0;
const newId = (): string => `b-${(_seq++).toString(36)}`;

const DEFAULT_COLOR = '#000000ff';

function propsFor(side: BorderSide): { width: string; style: string; color: string } {
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
function cssColorToHex8(raw: string): string {
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
 * Derive the editor entries from the target element's inline style.
 *
 * Source-of-truth rule: paperx writes everything through StyleEditService
 * into inline style, so we mirror back from there. We read inline style
 * (not computed) so a per-side longhand the user explicitly set takes
 * precedence over UA-default values; "no border touched yet" gives an
 * empty array (matches the "No border. Click + to add one." empty state).
 */
function deriveEntriesFromTarget(target: HTMLElement): BorderEntry[] {
  const s = target.style;

  // 'All' detection: any of the three shorthands set inline.
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

  // Per-side: walk top/right/bottom/left in plan order. Include any side
  // that has at least one of its longhands set inline.
  const entries: BorderEntry[] = [];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
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
function deriveGlobalStyle(target: HTMLElement): BorderStyle {
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

function splitHex8(hex8: string): { hex6: string; alphaPercent: number } {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex8);
  if (!m) return { hex6: '000000', alphaPercent: 100 };
  const hex6 = m[1]!.toLowerCase();
  const alphaHex = m[2];
  const alphaPercent = alphaHex
    ? Math.round((parseInt(alphaHex, 16) / 255) * 100)
    : 100;
  return { hex6, alphaPercent };
}

function joinHex8(hex6: string, alphaPercent: number): string {
  const cleaned = hex6.replace(/^#/, '').padEnd(6, '0').slice(0, 6);
  const a = Math.round(Math.max(0, Math.min(100, alphaPercent)) * 2.55);
  const aHex = a.toString(16).padStart(2, '0');
  return `#${cleaned}${aHex}`;
}

interface RowProps {
  entry: BorderEntry;
  usedSides: Set<BorderSide>;
  onChangeSide: (id: string, next: BorderSide) => void;
  onChangeWidth: (id: string, width: number) => void;
  onChangeColor: (id: string, color: string) => void;
  onPreviewColor: (id: string, color: string) => void;
  onToggleVisible: (id: string) => void;
  onRemove: (id: string) => void;
}

const Row: React.FC<RowProps> = ({
  entry,
  usedSides,
  onChangeSide,
  onChangeWidth,
  onChangeColor,
  onPreviewColor,
  onToggleVisible,
  onRemove,
}) => {
  const { hex6, alphaPercent } = splitHex8(entry.color);
  const [hexDraft, setHexDraft] = React.useState<string>(hex6);
  const [alphaDraft, setAlphaDraft] = React.useState<string>(String(alphaPercent));

  React.useEffect(() => setHexDraft(hex6), [hex6]);
  React.useEffect(() => setAlphaDraft(String(alphaPercent)), [alphaPercent]);

  const commitHex = () => {
    const trimmed = hexDraft.trim();
    if (!/^[0-9a-f]{6}$/i.test(trimmed)) {
      setHexDraft(hex6);
      return;
    }
    onChangeColor(entry.id, joinHex8(trimmed, alphaPercent));
  };

  const commitAlpha = () => {
    const n = parseInt(alphaDraft, 10);
    if (Number.isNaN(n)) {
      setAlphaDraft(String(alphaPercent));
      return;
    }
    onChangeColor(entry.id, joinHex8(hex6, n));
  };

  return (
    <div className="flex flex-col gap-1" data-testid={`paperx-border-row-${entry.id}`}>
      <div className="flex items-center gap-1.5">
        {/* Width */}
        <div className="flex h-6 flex-1 items-center gap-1 rounded-sm border border-input bg-white/5 px-1.5">
          <AlignJustify className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            data-testid={`paperx-border-${entry.id}-width`}
            type="text"
            inputMode="numeric"
            value={entry.width === 0 ? '' : String(entry.width)}
            placeholder="0"
            onChange={(e) => {
              const n = parseInt(e.currentTarget.value, 10);
              onChangeWidth(entry.id, Number.isFinite(n) && n >= 0 ? n : 0);
            }}
            className="h-5 w-full border-0 bg-transparent px-0 text-[11px] focus-visible:ring-0"
          />
        </div>

        {/* Direction */}
        <div className="flex h-6 flex-1 items-center gap-1 rounded-sm border border-input bg-white/5 px-1.5">
          <Square className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <select
            data-testid={`paperx-border-${entry.id}-direction`}
            value={entry.side}
            onChange={(e) => onChangeSide(entry.id, e.currentTarget.value as BorderSide)}
            className="h-5 w-full border-0 bg-transparent text-[11px] outline-none"
          >
            {SIDE_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.value !== entry.side && usedSides.has(opt.value)}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Visibility */}
        <button
          type="button"
          data-testid={`paperx-border-${entry.id}-visible`}
          aria-pressed={entry.visible}
          aria-label={entry.visible ? 'Hide' : 'Show'}
          onClick={() => onToggleVisible(entry.id)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {entry.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>

        {/* Remove */}
        <button
          type="button"
          data-testid={`paperx-border-${entry.id}-remove`}
          aria-label="Remove border"
          onClick={() => onRemove(entry.id)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Color sub-row */}
      <div className="flex h-6 items-center gap-1.5 rounded-sm border border-input bg-white/5 px-1.5">
        <ColorPicker
          value={entry.color}
          onChange={(next) => onChangeColor(entry.id, next)}
          onPreview={(next) => onPreviewColor(entry.id, next)}
          ariaLabel="Border color"
        />
        <Input
          data-testid={`paperx-border-${entry.id}-color-input`}
          type="text"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.currentTarget.value.replace(/^#/, ''))}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-5 w-20 border-0 bg-transparent px-0 text-[11px] uppercase focus-visible:ring-0"
        />
        <span className="text-[10px] text-muted-foreground">/</span>
        <Input
          data-testid={`paperx-border-${entry.id}-alpha-input`}
          type="text"
          inputMode="numeric"
          value={alphaDraft}
          onChange={(e) => setAlphaDraft(e.currentTarget.value)}
          onBlur={commitAlpha}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-5 w-10 border-0 bg-transparent px-0 text-right text-[11px] focus-visible:ring-0"
        />
        <span className="text-[10px] text-muted-foreground">%</span>
      </div>
    </div>
  );
};

export const BorderSection = observer(({ target, styleEdit }: Props) => {
  // Entries + global style derive from the target's inline style on
  // every mount AND every target change. This makes the editor a pure
  // reflection of host-page state, so:
  //   - collapsing the section (which unmounts CardContent) and
  //     re-expanding restores the live border config from inline style
  //   - switching the selected element re-seeds the panel with that
  //     element's current border config
  const [entries, setEntries] = React.useState<BorderEntry[]>(() =>
    deriveEntriesFromTarget(target),
  );
  const [globalStyle, setGlobalStyle] = React.useState<BorderStyle>(() =>
    deriveGlobalStyle(target),
  );
  const [styleMenuOpen, setStyleMenuOpen] = React.useState(false);
  const portalContainer = usePortalContainer();

  // Re-seed when the user picks a different element. We don't observe
  // target.style mutations (host page may churn every frame and the
  // overhead isn't worth it for a review panel) — only the prop swap.
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

  const writeEntry = (entry: BorderEntry, style: BorderStyle) => {
    const p = propsFor(entry.side);
    styleEdit.apply(target, p.width, `${entry.width}px`);
    styleEdit.apply(target, p.style, entry.visible ? style : 'none');
    styleEdit.apply(target, p.color, entry.color);
  };

  const clearSide = (side: BorderSide) => {
    const p = propsFor(side);
    styleEdit.apply(target, p.width, '');
    styleEdit.apply(target, p.style, '');
    styleEdit.apply(target, p.color, '');
  };

  const handleAdd = () => {
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
  };

  const handleChangeSide = (id: string, next: BorderSide) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx < 0) return prev;
      const current = prev[idx]!;
      if (current.side === next) return prev;
      // Duplicate guard.
      if (prev.some((e) => e.id !== id && e.side === next)) return prev;

      if (next === 'all') {
        // Collapse: clear every OTHER entry's inline style + remove them.
        for (const e of prev) {
          if (e.id !== id) clearSide(e.side);
        }
        // Clear the surviving entry's previous longhands so the new
        // `border` shorthand isn't competing with stale longhands.
        clearSide(current.side);
        const updated: BorderEntry = { ...current, side: 'all' };
        writeEntry(updated, globalStyle);
        return [updated];
      }

      // From All → per-side or per-side → per-side: clear the OLD
      // props before writing the new ones.
      clearSide(current.side);
      const updated: BorderEntry = { ...current, side: next };
      writeEntry(updated, globalStyle);
      return prev.map((e) => (e.id === id ? updated : e));
    });
  };

  const handleChangeWidth = (id: string, width: number) => {
    setEntries((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, width } : e));
      const entry = next.find((e) => e.id === id);
      if (entry) writeEntry(entry, globalStyle);
      return next;
    });
  };

  const handleChangeColor = (id: string, color: string) => {
    setEntries((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, color } : e));
      const entry = next.find((e) => e.id === id);
      if (entry) writeEntry(entry, globalStyle);
      return next;
    });
  };

  const handlePreviewColor = (id: string, color: string) => {
    // Live preview routes through the same commit path. Side effect:
    // ChangeLog records each preview step, but it matches the rest of
    // paperx's commit-on-change pattern (DesignPanel Typography Field,
    // BoxModel inputs, etc.).
    handleChangeColor(id, color);
  };

  const handleToggleVisible = (id: string) => {
    setEntries((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e));
      const entry = next.find((e) => e.id === id);
      if (entry) writeEntry(entry, globalStyle);
      return next;
    });
  };

  const handleRemove = (id: string) => {
    const found = entries.find((e) => e.id === id);
    if (found) clearSide(found.side);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSetStyle = (style: BorderStyle) => {
    setGlobalStyle(style);
    setStyleMenuOpen(false);
    for (const entry of entries) writeEntry(entry, style);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="normal-case tracking-normal">Border</Label>
        <div className="flex items-center gap-1">
          {/* Style picker (global) */}
          <Popover.Root open={styleMenuOpen} onOpenChange={setStyleMenuOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                data-testid="paperx-border-style-trigger"
                aria-label="Border style"
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <SlidersHorizontal className="h-3 w-3" />
              </button>
            </Popover.Trigger>
            <Popover.Portal container={portalContainer}>
              <Popover.Content
                sideOffset={6}
                align="end"
                className={cn(
                  'paperx-surface pointer-events-auto',
                  'z-[2147483647] w-28 rounded-md p-1 shadow-xl outline-none',
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {STYLE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-testid={`paperx-border-style-${s}`}
                    onClick={() => handleSetStyle(s)}
                    className={cn(
                      'flex h-7 w-full items-center justify-start gap-1.5 rounded-sm px-2 text-[11px] capitalize transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      globalStyle === s ? 'text-white' : 'text-muted-foreground',
                    )}
                  >
                    {globalStyle === s ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="inline-block h-3 w-3" />
                    )}
                    <span>{s}</span>
                  </button>
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* Add row */}
          <button
            type="button"
            data-testid="paperx-border-add"
            aria-label="Add border direction"
            onClick={handleAdd}
            disabled={!canAdd}
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-sm border border-dashed border-input bg-white/[0.02] px-2 py-3 text-center text-[10px] text-muted-foreground">
          No border. Click + to add one.
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="paperx-border-rows">
          {entries.map((entry) => (
            <Row
              key={entry.id}
              entry={entry}
              usedSides={usedSides}
              onChangeSide={handleChangeSide}
              onChangeWidth={handleChangeWidth}
              onChangeColor={handleChangeColor}
              onPreviewColor={handlePreviewColor}
              onToggleVisible={handleToggleVisible}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
});
BorderSection.displayName = 'BorderSection';

export type { BorderEntry, BorderSide, BorderStyle };
