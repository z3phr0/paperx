/**
 * Fill section — Solid / Gradient / Image tabbed editor.
 *
 * v0.11.0 scope: Solid commits `background-color` via StyleEditService
 * through `useFillEditor`. Gradient + Image render visual shells only —
 * no write path attached this period; the shells preserve fidelity so
 * later sprints can attach the writer without re-doing the visual.
 *
 * Section starts collapsed when no fill exists; `+` materialises a
 * single fill entry whose color is then edited via the shared v2
 * ColorPicker — same component the Border section uses.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { IconButton, Section, Segmented } from '@/shared/ui-v2';
import { ColorPicker } from '@/shared/ui/ColorPicker';
import { useFillEditor } from '@/shared/design-logic/fill';

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
  const {
    entries,
    canAdd,
    handleAdd,
    handleChangeColor,
    handlePreviewColor,
    handleToggleVisible,
    handleRemove,
  } = useFillEditor({ target, styleEdit });

  const entry = entries[0];

  return (
    <Section
      title="Fill"
      data-testid="paperx-v2-fill"
      collapsed={entries.length === 0}
      actions={
        <IconButton
          icon="plus"
          title="Add fill"
          onClick={handleAdd}
          disabled={!canAdd}
          data-testid="paperx-v2-fill-add"
        />
      }
    >
      {entry && (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          data-testid={`paperx-v2-fill-row-${entry.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Segmented
              full
              value={tab}
              onChange={setTab}
              items={TAB_ITEMS}
              data-testid="paperx-v2-fill-tabs"
            />
            <IconButton
              icon={entry.visible ? 'eye' : 'eye-off'}
              onClick={() => handleToggleVisible(entry.id)}
              data-testid="paperx-v2-fill-visibility"
              title={entry.visible ? 'Hide' : 'Show'}
            />
            <IconButton
              icon="minus"
              onClick={() => handleRemove(entry.id)}
              data-testid="paperx-v2-fill-remove"
              title="Remove fill"
            />
          </div>
          {tab === 'solid' && (
            <ColorPicker
              value={entry.color}
              onChange={(c) => handleChangeColor(entry.id, c)}
              onPreview={(c) => handlePreviewColor(entry.id, c)}
              triggerVariant="v2"
              ariaLabel="Fill color"
            />
          )}
          {tab === 'gradient' && <GradientShell />}
          {tab === 'image' && <ImageShell />}
        </div>
      )}
    </Section>
  );
});
FillSection.displayName = 'FillSection';
