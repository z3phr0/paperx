/**
 * Radius section — V2 visual reskin of the legacy unified/per-corner
 * editor. Behavior is `useRadiusEditor` (shared with V1).
 *
 * Two visual states, both authored from
 * figma-builder/project/paperx-inspector.jsx `RadiusSectionPX`:
 *   - unified:    slider + numeric input
 *   - per-corner: 4-input grid, each with a rotated corner glyph prefix
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import {
  type Corner,
  CORNERS,
  DEFAULT_RADIUS_PX,
  SLIDER_MAX,
  useRadiusEditor,
} from '@/shared/design-logic/radius';
import { IconButton, Input, Section, Slider } from '@/shared/ui-v2';

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

const ROTATION: Record<Corner, number> = { tl: 0, tr: 90, br: 180, bl: 270 };

const CornerGlyph: React.FC<{ corner: Corner }> = ({ corner }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: `rotate(${ROTATION[corner]}deg)` }}
    aria-hidden
  >
    <path d="M22 3H7a4 4 0 0 0-4 4v14" />
  </svg>
);

export const RadiusSectionV2 = observer(({ target, styleEdit }: Props) => {
  const {
    radius,
    mode,
    setMode,
    enabled,
    unifiedValue,
    unifiedNumber,
    commitUnified,
    commitCorner,
  } = useRadiusEditor({ target, styleEdit });

  return (
    <Section
      title="Radius"
      data-testid="paperx-radius"
      actions={
        enabled ? (
          <IconButton
            icon={mode === 'unified' ? 'maximize' : 'collapse'}
            onClick={() => setMode((m) => (m === 'unified' ? 'per-corner' : 'unified'))}
            title={mode === 'unified' ? 'Switch to per-corner' : 'Switch to unified'}
            data-testid="paperx-radius-mode-toggle"
          />
        ) : (
          <IconButton
            icon="plus"
            onClick={() => commitUnified(DEFAULT_RADIUS_PX)}
            title="Enable radius (8px)"
            data-testid="paperx-radius-add"
          />
        )
      }
    >
      {!enabled ? null : mode === 'unified' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 64px',
            gap: 10,
            alignItems: 'center',
          }}
          data-testid="paperx-radius-unified"
        >
          <Slider
            value={unifiedNumber}
            min={0}
            max={SLIDER_MAX}
            step={1}
            ariaLabel="Border radius"
            onPreview={(v) => commitUnified(String(v))}
            onChange={(v) => commitUnified(String(v))}
            data-testid="paperx-radius-unified-slider"
          />
          <Input
            value={unifiedValue}
            placeholder="0"
            data-testid="paperx-radius-unified-input"
            onChange={(next) => commitUnified(next)}
          />
        </div>
      ) : (
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}
          data-testid="paperx-radius-per-corner"
        >
          {CORNERS.map((c) => (
            <Input
              key={c}
              value={radius[c]}
              prefix={<CornerGlyph corner={c} />}
              placeholder="0"
              data-testid={`paperx-radius-${c}`}
              onChange={(next) => commitCorner(c, next)}
            />
          ))}
        </div>
      )}
    </Section>
  );
});
RadiusSectionV2.displayName = 'RadiusSectionV2';
