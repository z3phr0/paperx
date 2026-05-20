/**
 * Appearance section — Opacity, Corner radius, Overflow.
 *
 * Matches StyleSection from design-tab.jsx#L317-343. Each field commits
 * via IStyleEditService.apply so ChangeLog stays the single source of
 * truth for export/undo.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { formatLengthPx } from '@/shared/types/numeric';
import { Dropdown, Icon, IconButton, Input, Section } from '@/shared/ui-v2';
import { readPx } from '../hooks/useComputedStyle';

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

type Overflow = 'visible' | 'hidden' | 'scroll' | 'auto';

const OVERFLOW_OPTIONS: ReadonlyArray<{ value: Overflow; label: string }> = [
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'scroll', label: 'Scroll' },
  { value: 'auto', label: 'Auto' },
];

function readOpacityPercent(target: HTMLElement): string {
  const inline = target.style.opacity;
  const raw =
    inline ||
    (() => {
      try {
        return getComputedStyle(target).opacity ?? '';
      } catch {
        return '';
      }
    })();
  if (!raw) return '';
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 100));
}

function readOverflow(target: HTMLElement): Overflow {
  const inline = target.style.overflow as Overflow;
  if (
    inline === 'visible' ||
    inline === 'hidden' ||
    inline === 'scroll' ||
    inline === 'auto'
  ) {
    return inline;
  }
  try {
    const computed = getComputedStyle(target).overflow as Overflow;
    if (
      computed === 'visible' ||
      computed === 'hidden' ||
      computed === 'scroll' ||
      computed === 'auto'
    ) {
      return computed;
    }
  } catch {
    // computed read failed — fall through
  }
  return 'visible';
}

export const AppearanceSection = observer(({ target, styleEdit }: Props) => {
  const [opacity, setOpacity] = React.useState(() => readOpacityPercent(target));
  const [radius, setRadius] = React.useState(() => readPx(target, 'border-radius'));
  const [overflow, setOverflow] = React.useState<Overflow>(() => readOverflow(target));
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    setOpacity(readOpacityPercent(target));
    setRadius(readPx(target, 'border-radius'));
    setOverflow(readOverflow(target));
    setVisible(true);
  }, [target]);

  const commitOpacity = (raw: string) => {
    setOpacity(raw);
    const trimmed = raw.replace('%', '').trim();
    if (trimmed === '') return;
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(0, Math.min(100, n));
    styleEdit.apply(target, 'opacity', (clamped / 100).toFixed(2));
  };

  const commitRadius = (raw: string) => {
    setRadius(raw);
    if (raw.trim() === '') return;
    const formatted = formatLengthPx(raw, { allowNegative: false });
    if (formatted == null) return;
    styleEdit.apply(target, 'border-radius', formatted);
  };

  const commitOverflow = (v: Overflow) => {
    setOverflow(v);
    styleEdit.apply(target, 'overflow', v);
  };

  const toggleVisibility = () => {
    const next = !visible;
    setVisible(next);
    // Visibility toggle writes `display` (none / '') rather than `visibility`
    // so layout collapses while the toggle is off — matches Figma semantics.
    styleEdit.apply(target, 'display', next ? '' : 'none');
  };

  return (
    <Section
      title="Appearance"
      data-testid="paperx-v2-appearance"
      actions={
        <>
          <IconButton
            icon={visible ? 'eye' : 'eye-off'}
            title="Toggle visibility"
            onClick={toggleVisibility}
            data-testid="paperx-v2-appearance-visibility"
          />
          <IconButton icon="opacity" title="Opacity" />
        </>
      }
    >
      <div
        className="dv-col-2"
        style={{ marginBottom: 'var(--dv-gap-y)' }}
      >
        <div className="dv-row" style={{ marginBottom: 0 }}>
          <div className="dv-row-label">Opacity</div>
          <Input
            prefix={<Icon name="opacity" size={12} />}
            value={opacity}
            suffix="%"
            placeholder="100"
            data-testid="paperx-v2-appearance-opacity"
            onChange={commitOpacity}
          />
        </div>
        <div className="dv-row" style={{ marginBottom: 0 }}>
          <div className="dv-row-label">Corner radius</div>
          <Input
            prefix={<Icon name="corner" size={12} />}
            value={radius}
            placeholder="0"
            data-testid="paperx-v2-appearance-radius"
            onChange={commitRadius}
          />
        </div>
      </div>
      <div
        className="dv-row"
        style={{ gridTemplateColumns: '64px 1fr', gap: 6, alignItems: 'center', marginBottom: 0 }}
      >
        <div className="dv-row-label">Overflow</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Dropdown
            value={overflow}
            onChange={commitOverflow}
            items={OVERFLOW_OPTIONS}
            data-testid="paperx-v2-appearance-overflow"
          />
          <IconButton icon="sliders" title="Advanced overflow" />
        </div>
      </div>
    </Section>
  );
});
AppearanceSection.displayName = 'AppearanceSection';
