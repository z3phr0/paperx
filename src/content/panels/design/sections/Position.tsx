/**
 * Position section — position + top/right/bottom/left.
 *
 * The 4 offset inputs are always rendered; they are no-ops when
 * `position: static` (the browser ignores them) but we don't gate the UI
 * — keeping the inputs visible is friendlier than hiding/showing.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Select } from '@/shared/ui/Select';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

const POSITION_OPTIONS = [
  { value: 'static', label: 'static' },
  { value: 'relative', label: 'relative' },
  { value: 'absolute', label: 'absolute' },
  { value: 'fixed', label: 'fixed' },
  { value: 'sticky', label: 'sticky' },
];

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];

function read(target: HTMLElement, prop: string): string {
  const inline = target.style.getPropertyValue(prop);
  if (inline) return inline;
  try {
    return getComputedStyle(target).getPropertyValue(prop) ?? '';
  } catch {
    return '';
  }
}

function strip(raw: string): string {
  if (!raw || raw === 'auto') return '';
  const m = raw.match(/^(-?[\d.]+)px$/);
  return m && m[1] ? m[1] : raw;
}

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const PositionSection = observer(({ target, styleEdit }: Props) => {
  const positionSeed = React.useMemo(() => read(target, 'position').trim(), [target]);
  const [pos, setPos] = React.useState(positionSeed || 'static');
  React.useEffect(() => setPos(positionSeed || 'static'), [positionSeed]);

  const offsetSeed = React.useMemo(
    () => Object.fromEntries(SIDES.map((s) => [s, strip(read(target, s))])) as Record<Side, string>,
    [target],
  );
  const [offsets, setOffsets] = React.useState(offsetSeed);
  React.useEffect(() => setOffsets(offsetSeed), [offsetSeed]);

  const commitOffset = (side: Side, raw: string) => {
    setOffsets((prev) => ({ ...prev, [side]: raw }));
    if (raw === '') return;
    const n = parseFloat(raw);
    if (Number.isNaN(n)) {
      // allow keywords like `auto` straight through
      styleEdit.apply(target, side, raw);
      return;
    }
    styleEdit.apply(target, side, `${n}px`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="w-16 normal-case tracking-normal">Position</Label>
        <Select
          value={pos}
          options={POSITION_OPTIONS}
          onChange={(e) => {
            setPos(e.target.value);
            styleEdit.apply(target, 'position', e.target.value);
          }}
          className="flex-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-1">
        {SIDES.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <Label className="w-10 normal-case tracking-normal">{s}</Label>
            <Input
              type="text"
              value={offsets[s]}
              onChange={(e) => commitOffset(s, e.target.value)}
              placeholder="auto"
              className="flex-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
});
PositionSection.displayName = 'PositionSection';
