/**
 * Text section — font family/weight, size/line-height/letter-spacing,
 * horizontal + vertical alignment. Header sliders button toggles the
 * advanced Formatting popup (rendered by DesignPanelV2).
 *
 * Source: figma-builder/project/text-panel.jsx#TextSection. Dropdown
 * primitives use the project's <Dropdown> instead of the design-source's
 * hand-rolled menus (CLAUDE.md: reuse existing primitives before adding
 * deps). Icons are inlined here because they are domain-specific glyphs
 * not worth promoting into the shared Icon set.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { Section, Input, Dropdown, Segmented, IconButton, Icon } from '@/shared/ui-v2';
import { useSeededValue } from '../hooks/useComputedStyle';

/* ─────────────────────────────────────────────────────────────────────
 * Inline glyph icons (drawn to feel like real type metrics).
 * Stroke is `currentColor` so they inherit dv-text-muted from .dv-input-prefix
 * and dv-text-secondary from .dv-seg-item, just like Icon does.
 * ──────────────────────────────────────────────────────────────────── */
type GlyphProps = { size?: number };

const Glyph: React.FC<GlyphProps & { children: React.ReactNode }> = ({
  size = 13,
  children,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const IconFontFamily: React.FC<GlyphProps> = (p) => (
  <Glyph {...p}>
    <path d="M7.5 19c0 0-.5-2 .5-6.5S11 4.5 14 4.5c1.6 0 2.5.7 2.8 1.6" />
    <path d="M5.5 12.5 H13" />
  </Glyph>
);

const IconFontWeight: React.FC<GlyphProps> = (p) => (
  <Glyph {...p}>
    <path d="M5 14 L10.5 4 L16 14" />
    <path d="M7 11 H14" />
    <path d="M4 19 L20 19" />
    <path d="M4 19 L6.5 17.2 M4 19 L6.5 20.8" />
    <path d="M20 19 L17.5 17.2 M20 19 L17.5 20.8" />
  </Glyph>
);

const IconLineHeight: React.FC<GlyphProps> = (p) => (
  <Glyph {...p}>
    <path d="M5 4 L5 20" />
    <path d="M3 6 L5 4 L7 6" />
    <path d="M3 18 L5 20 L7 18" />
    <path d="M10.5 18 L15.5 6 L20.5 18" />
    <path d="M12.2 14 H18.8" />
  </Glyph>
);

const IconFontSize: React.FC<GlyphProps> = (p) => (
  <Glyph {...p}>
    <path d="M3.5 4 H20.5" />
    <path d="M5.5 19 L11.5 7 L17.5 19" />
    <path d="M7.5 15 H15.5" />
  </Glyph>
);

const IconLetterSpacing: React.FC<GlyphProps> = (p) => (
  <Glyph {...p}>
    <path d="M3.5 4 L3.5 20" />
    <path d="M20.5 4 L20.5 20" />
    <path d="M6.8 18 L11.5 7 L16.2 18" />
    <path d="M8.5 14 H14.5" />
  </Glyph>
);

const IconAlignH: React.FC<GlyphProps & { dir: 'left' | 'center' | 'right' }> = ({
  size = 14,
  dir,
}) => {
  const map: Record<typeof dir, ReadonlyArray<readonly [number, number]>> = {
    left: [
      [4, 16],
      [4, 11],
      [4, 14],
    ],
    center: [
      [6, 12],
      [3, 18],
      [5, 14],
    ],
    right: [
      [4, 16],
      [9, 11],
      [6, 14],
    ],
  };
  const ys = [6, 12, 18];
  return (
    <Glyph size={size}>
      {map[dir].map(([x, w], i) => (
        <line key={i} x1={x} y1={ys[i]} x2={x + w} y2={ys[i]} strokeWidth={1.6} />
      ))}
    </Glyph>
  );
};

const IconAlignV: React.FC<GlyphProps & { dir: 'top' | 'middle' | 'bottom' }> = ({
  size = 14,
  dir,
}) => {
  if (dir === 'top') {
    return (
      <Glyph size={size}>
        <path d="M4 4 H20" />
        <path d="M12 8 L12 20" />
        <path d="M8.5 11.5 L12 8 L15.5 11.5" />
      </Glyph>
    );
  }
  if (dir === 'middle') {
    return (
      <Glyph size={size}>
        <path d="M4 12 H20" />
        <path d="M12 3 L12 9" />
        <path d="M12 21 L12 15" />
        <path d="M8.5 5.5 L12 9 L15.5 5.5" />
        <path d="M8.5 18.5 L12 15 L15.5 18.5" />
      </Glyph>
    );
  }
  return (
    <Glyph size={size}>
      <path d="M4 20 H20" />
      <path d="M12 16 L12 4" />
      <path d="M8.5 12.5 L12 16 L15.5 12.5" />
    </Glyph>
  );
};

export {
  IconFontFamily,
  IconFontWeight,
  IconLineHeight,
  IconFontSize,
  IconLetterSpacing,
  IconAlignH,
  IconAlignV,
};

/* ─────────────────────────────────────────────────────────────────────
 * Preset lists
 * ──────────────────────────────────────────────────────────────────── */
const FONT_FAMILY_PRESETS = [
  { value: 'system-ui', label: 'System' },
  { value: 'sans-serif', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: 'Helvetica Neue, Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Roboto, system-ui, sans-serif', label: 'Roboto' },
] as const;

const FONT_WEIGHT_PRESETS = [
  { value: '100', label: 'Thin (100)' },
  { value: '200', label: 'Extra-light (200)' },
  { value: '300', label: 'Light (300)' },
  { value: '400', label: 'Regular (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semibold (600)' },
  { value: '700', label: 'Bold (700)' },
  { value: '800', label: 'Extra-bold (800)' },
  { value: '900', label: 'Black (900)' },
] as const;

/* ─────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────── */
function readInlineOrComputed(target: HTMLElement, prop: string): string {
  const inline = target.style.getPropertyValue(prop);
  if (inline) return inline.trim();
  try {
    return (getComputedStyle(target).getPropertyValue(prop) ?? '').trim();
  } catch {
    return '';
  }
}

/** Normalize a font-family computed string ('"Helvetica Neue", Arial')
 *  by collapsing double-quotes/whitespace so it can be compared against
 *  our preset values. Returns '' when the value can't be matched. */
function matchFontFamily(raw: string): string {
  const norm = raw.replace(/['"]/g, '').replace(/\s*,\s*/g, ', ').trim();
  for (const p of FONT_FAMILY_PRESETS) {
    if (p.value.replace(/\s*,\s*/g, ', ') === norm) return p.value;
  }
  return '';
}

type HAlign = 'left' | 'center' | 'right';
type VAlign = 'top' | 'middle' | 'bottom';

function readHAlign(target: HTMLElement): HAlign {
  const raw = readInlineOrComputed(target, 'text-align');
  if (raw === 'center' || raw === 'right') return raw;
  // `justify` (or anything else) falls back to `left` in the 3-way control.
  return 'left';
}

function readVAlign(target: HTMLElement): VAlign {
  const raw = readInlineOrComputed(target, 'align-self');
  if (raw === 'center') return 'middle';
  if (raw === 'flex-end' || raw === 'end') return 'bottom';
  return 'top';
}

const V_ALIGN_TO_CSS: Record<VAlign, string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

/* ─────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────── */
export interface TextSectionProps {
  target: HTMLElement;
  styleEdit: IStyleEditService;
  /** Ref attached to the section wrapper. Used by the Formatting popup
   *  to align its top edge with this section's top in viewport coords. */
  sectionRef?: React.Ref<HTMLDivElement>;
  onToggleFormatting?: () => void;
}

export const TextSection = observer(
  ({
    target,
    styleEdit,
    sectionRef,
    onToggleFormatting,
  }: TextSectionProps) => {
    const [fontFamily, setFontFamily] = React.useState<string>(() =>
      matchFontFamily(readInlineOrComputed(target, 'font-family')),
    );
    const [fontWeight, setFontWeight] = React.useState<string>(() => {
      const raw = readInlineOrComputed(target, 'font-weight');
      if (FONT_WEIGHT_PRESETS.find((w) => w.value === raw)) return raw;
      // `normal`→400, `bold`→700
      if (raw === 'normal') return '400';
      if (raw === 'bold') return '700';
      return '';
    });
    const [lineHeight, setLineHeight] = useSeededValue(target, 'line-height');
    const [fontSize, setFontSize] = useSeededValue(target, 'font-size');
    const [letterSpacing, setLetterSpacing] = React.useState<string>(() =>
      readInlineOrComputed(target, 'letter-spacing'),
    );
    const [hAlign, setHAlign] = React.useState<HAlign>(() => readHAlign(target));
    const [vAlign, setVAlign] = React.useState<VAlign>(() => readVAlign(target));

    // Re-seed every field when the selected target changes.
    React.useEffect(() => {
      setFontFamily(matchFontFamily(readInlineOrComputed(target, 'font-family')));
      const w = readInlineOrComputed(target, 'font-weight');
      setFontWeight(
        FONT_WEIGHT_PRESETS.find((wp) => wp.value === w)
          ? w
          : w === 'normal'
            ? '400'
            : w === 'bold'
              ? '700'
              : '',
      );
      setLetterSpacing(readInlineOrComputed(target, 'letter-spacing'));
      setHAlign(readHAlign(target));
      setVAlign(readVAlign(target));
      // line-height / font-size are seeded by useSeededValue's own effect.
    }, [target, setFontFamily, setFontWeight, setLetterSpacing, setHAlign, setVAlign]);

    const commitFontFamily = (v: string): void => {
      setFontFamily(v);
      styleEdit.apply(target, 'font-family', v);
    };
    const commitFontWeight = (v: string): void => {
      setFontWeight(v);
      styleEdit.apply(target, 'font-weight', v);
    };
    const commitLineHeight = (raw: string): void => {
      setLineHeight(raw);
      const trimmed = raw.trim();
      if (trimmed === '') return;
      // line-height accepts unitless multipliers AND lengths — only append
      // `px` when the user gave a bare number, never when they typed a unit
      // (or `normal`).
      const next = /^[\d.]+$/.test(trimmed) ? `${trimmed}px` : trimmed;
      styleEdit.apply(target, 'line-height', next);
    };
    const commitFontSize = (raw: string): void => {
      setFontSize(raw);
      const trimmed = raw.trim();
      if (trimmed === '') return;
      const next = /^[\d.]+$/.test(trimmed) ? `${trimmed}px` : trimmed;
      styleEdit.apply(target, 'font-size', next);
    };
    const commitLetterSpacing = (raw: string): void => {
      setLetterSpacing(raw);
      const trimmed = raw.trim();
      if (trimmed === '') return;
      const next = /^-?[\d.]+$/.test(trimmed) ? `${trimmed}px` : trimmed;
      styleEdit.apply(target, 'letter-spacing', next);
    };
    const commitHAlign = (v: HAlign): void => {
      setHAlign(v);
      styleEdit.apply(target, 'text-align', v);
    };
    const commitVAlign = (v: VAlign): void => {
      setVAlign(v);
      styleEdit.apply(target, 'align-self', V_ALIGN_TO_CSS[v]);
    };

    return (
      <div ref={sectionRef}>
        <Section
          title="Text"
          data-testid="paperx-v2-text"
          actions={
            <IconButton
              icon={<Icon name="sliders" size={14} />}
              title="Formatting"
              onClick={onToggleFormatting}
              data-testid="paperx-v2-text-fmt-toggle"
            />
          }
        >
          {/* Font family */}
          <div className="dv-row" style={{ marginBottom: 6 }}>
            <Dropdown
              value={fontFamily}
              onChange={commitFontFamily}
              items={FONT_FAMILY_PRESETS}
              placeholder="—"
              prefix={
                <span
                  className="dv-input-prefix"
                  style={{ marginRight: 6, color: 'var(--dv-text-muted)' }}
                >
                  <IconFontFamily />
                </span>
              }
              data-testid="paperx-v2-text-font-family"
              itemTestidPrefix="paperx-v2-text-font-family"
            />
          </div>

          {/* Font weight */}
          <div className="dv-row" style={{ marginBottom: 6 }}>
            <Dropdown
              value={fontWeight}
              onChange={commitFontWeight}
              items={FONT_WEIGHT_PRESETS}
              placeholder="—"
              prefix={
                <span
                  className="dv-input-prefix"
                  style={{ marginRight: 6, color: 'var(--dv-text-muted)' }}
                >
                  <IconFontWeight />
                </span>
              }
              data-testid="paperx-v2-text-font-weight"
              itemTestidPrefix="paperx-v2-text-font-weight"
            />
          </div>

          {/* Line-height · Font-size · Letter-spacing */}
          <div
            className="dv-row"
            style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}
          >
            <Input
              prefix={<IconLineHeight size={12} />}
              value={lineHeight}
              placeholder="—"
              data-testid="paperx-v2-text-line-height"
              onChange={commitLineHeight}
            />
            <Input
              prefix={<IconFontSize size={12} />}
              value={fontSize}
              placeholder="—"
              data-testid="paperx-v2-text-font-size"
              onChange={commitFontSize}
            />
            <Input
              prefix={<IconLetterSpacing size={12} />}
              value={letterSpacing}
              placeholder="—"
              numeric={false}
              data-testid="paperx-v2-text-letter-spacing"
              onChange={commitLetterSpacing}
            />
          </div>

          {/* Alignment — horizontal (3) | vertical (3) */}
          <div
            className="dv-row"
            style={{ gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 0 }}
          >
            <Segmented<HAlign>
              full
              value={hAlign}
              onChange={commitHAlign}
              items={[
                { value: 'left', icon: <IconAlignH dir="left" />, title: 'Align left' },
                {
                  value: 'center',
                  icon: <IconAlignH dir="center" />,
                  title: 'Align center',
                },
                { value: 'right', icon: <IconAlignH dir="right" />, title: 'Align right' },
              ]}
              data-testid="paperx-v2-text-halign"
            />
            <Segmented<VAlign>
              full
              value={vAlign}
              onChange={commitVAlign}
              items={[
                { value: 'top', icon: <IconAlignV dir="top" />, title: 'Align top' },
                {
                  value: 'middle',
                  icon: <IconAlignV dir="middle" />,
                  title: 'Align middle',
                },
                {
                  value: 'bottom',
                  icon: <IconAlignV dir="bottom" />,
                  title: 'Align bottom',
                },
              ]}
              data-testid="paperx-v2-text-valign"
            />
          </div>
        </Section>
      </div>
    );
  },
);
TextSection.displayName = 'TextSection';
