/**
 * Fill section — Solid / Gradient / Image tabbed editor.
 *
 * One-period scope (see plan): Solid commits via StyleEditService;
 * Gradient + Image render the design-spec UI only (no write path yet).
 * The UI shells preserve visual fidelity so later sprints can attach
 * the writer without re-doing the visual.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { IconButton, Section, Segmented, Swatch } from '@/shared/ui-v2';
import { cssColorToHex8 } from '@/shared/design-logic/border';

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

type FillTab = 'solid' | 'gradient' | 'image';

const TAB_ITEMS: ReadonlyArray<{ value: FillTab; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'image', label: 'Image' },
];

function readBackgroundHex8(target: HTMLElement): string {
  const inline = target.style.backgroundColor;
  if (inline) return cssColorToHex8(inline);
  try {
    const computed = getComputedStyle(target).backgroundColor;
    if (computed) return cssColorToHex8(computed);
  } catch {
    // ignore — fall through
  }
  return '#ffffffff';
}

function hex8ToRgba(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1]!, 16);
  const g = parseInt(m[2]!, 16);
  const b = parseInt(m[3]!, 16);
  const a = parseInt(m[4]!, 16) / 255;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

/**
 * Solid color editor — single row with swatch, hex display, alpha %.
 * Clicking the row opens the legacy ColorPicker (deferred wiring; for
 * now the row is informational and the swatch is the primary affordance).
 */
const SolidRow: React.FC<{ hex8: string }> = ({ hex8 }) => {
  const alpha = parseInt(hex8.slice(7, 9) || 'ff', 16) / 255;
  const rgbHex = hex8.slice(1, 7).toUpperCase();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 8px',
        background: 'var(--dv-bg-input)',
        borderRadius: 'var(--dv-r-input)',
        height: 'var(--dv-row-h)',
      }}
      data-testid="paperx-v2-fill-solid-row"
    >
      <Swatch color={`#${rgbHex}`} alpha={alpha} />
      <span
        style={{
          fontSize: 'var(--dv-value-size)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
        }}
      >
        {rgbHex}
      </span>
      <span style={{ fontSize: 'var(--dv-value-size)', color: 'var(--dv-text-muted)' }}>/</span>
      <span
        style={{
          fontSize: 'var(--dv-value-size)',
          fontVariantNumeric: 'tabular-nums',
          flex: 1,
        }}
      >
        {Math.round(alpha * 100)}%
      </span>
    </div>
  );
};

/**
 * Gradient editor visual shell. The actual gradient bar + stops list +
 * type thumbs reproduce the design-tab.jsx#GradientBar/GradTypeThumb
 * elements; no write path attached this period.
 */
const GradientShell: React.FC = () => {
  const stops = [
    { color: '#FFFFFF' },
    { color: '#DFDFDF' },
    { color: '#D8D8D8' },
    { color: '#D2D2D2' },
    { color: '#CCCCCC' },
    { color: '#BEBEBE' },
  ];
  const bg = `linear-gradient(90deg, ${stops
    .map((s, i) => `${s.color} ${(i / (stops.length - 1)) * 100}%`)
    .join(',')})`;
  return (
    <>
      <div
        style={{ position: 'relative', height: 36, marginTop: 4, marginBottom: 16 }}
        data-testid="paperx-v2-fill-gradient-bar"
      >
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 0,
            right: 0,
            height: 14,
            borderRadius: 3,
            background: bg,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        />
        {stops.map((_, i) => {
          const pct = (i / (stops.length - 1)) * 100;
          return (
            <React.Fragment key={i}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `calc(${pct}% - 5px)`,
                  width: 10,
                  height: 10,
                  background: 'var(--dv-text-secondary)',
                  transform: 'rotate(45deg)',
                  borderRadius: 1,
                  border: '1px solid rgba(0, 0, 0, 0.4)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 22,
                  left: `calc(${pct}% - 6px)`,
                  width: 12,
                  height: 14,
                  background: 'var(--dv-text-secondary)',
                  clipPath: 'polygon(50% 0, 100% 35%, 100% 100%, 0 100%, 0 35%)',
                  border: '1px solid rgba(0, 0, 0, 0.4)',
                }}
              />
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['linear', 'radial', 'conic'] as const).map((kind, i) => {
            const bgKind: Record<typeof kind, string> = {
              linear: 'linear-gradient(90deg,#fff,#3a3a3a)',
              radial: 'radial-gradient(circle at center,#fff 0%,#1a1a1a 80%)',
              conic: 'conic-gradient(from 180deg at 50% 50%,#fff,#1a1a1a,#fff)',
            };
            const active = i === 0;
            return (
              <button
                key={kind}
                type="button"
                title={kind}
                style={{
                  width: 32,
                  height: 24,
                  borderRadius: 5,
                  cursor: 'pointer',
                  padding: 0,
                  border: `1px solid ${active ? 'var(--dv-text)' : 'var(--dv-border)'}`,
                  background: bgKind[kind],
                }}
              />
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <IconButton icon="sliders" title="Settings" />
        <IconButton icon="rotate" title="Reverse" />
        <IconButton icon="plus" title="Add stop" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {stops.map((s, i) => (
          <SolidRow key={i} hex8={`${s.color}ff`.toLowerCase()} />
        ))}
      </div>
    </>
  );
};

const ImageShell: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: 8,
      background: 'var(--dv-bg-input)',
      borderRadius: 'var(--dv-r-input)',
    }}
    data-testid="paperx-v2-fill-image"
  >
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 4,
        background:
          'linear-gradient(135deg,#a3c4e7 0%,#f5d76e 50%,#5a8a3a 100%)',
        flexShrink: 0,
      }}
    />
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        flowers.webp
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--dv-text-muted)',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        1600×1200
      </div>
    </div>
  </div>
);

export const FillSection = observer(({ target, styleEdit }: Props) => {
  const [tab, setTab] = React.useState<FillTab>('solid');
  const [visible, setVisible] = React.useState(true);
  const [hex8, setHex8] = React.useState(() => readBackgroundHex8(target));

  React.useEffect(() => {
    setHex8(readBackgroundHex8(target));
    setVisible(true);
  }, [target]);

  const onToggleVisible = () => {
    const next = !visible;
    setVisible(next);
    if (!next) {
      styleEdit.apply(target, 'background-color', 'transparent');
    } else {
      styleEdit.apply(target, 'background-color', hex8ToRgba(hex8));
    }
  };

  return (
    <Section
      title="Fill"
      data-testid="paperx-v2-fill"
      actions={<IconButton icon="plus" title="Add fill" />}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Segmented
          full
          value={tab}
          onChange={setTab}
          items={TAB_ITEMS}
          data-testid="paperx-v2-fill-tabs"
        />
        <IconButton
          icon={visible ? 'eye' : 'eye-off'}
          onClick={onToggleVisible}
          data-testid="paperx-v2-fill-visibility"
        />
        <IconButton icon="minus" />
      </div>

      {tab === 'solid' && <SolidRow hex8={hex8} />}
      {tab === 'gradient' && <GradientShell />}
      {tab === 'image' && <ImageShell />}
    </Section>
  );
});
FillSection.displayName = 'FillSection';
