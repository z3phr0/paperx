/**
 * Spacing section — padding / margin with optional 4-side sync.
 *
 * UX:
 *   - 4 inputs (top/right/bottom/left) per box
 *   - "Link" toggle: when on, editing any side broadcasts the value to all
 *     four (Figma "constrain" behavior)
 *   - Negative values allowed for margin, clamped to >= 0 for padding
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

type Box = 'padding' | 'margin';
type Side = 'top' | 'right' | 'bottom' | 'left';

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'] as const;

function read(target: HTMLElement, box: Box, side: Side): string {
  const prop = `${box}-${side}`;
  const inline = target.style.getPropertyValue(prop);
  if (inline) return inline;
  try {
    return getComputedStyle(target).getPropertyValue(prop) ?? '';
  } catch {
    return '';
  }
}

function strip(raw: string): string {
  // Trim trailing "px" so the input shows just the number (consistent with Figma).
  if (!raw) return '';
  const m = raw.match(/^(-?[\d.]+)px$/);
  return m && m[1] ? m[1] : raw;
}

function format(num: string, allowNegative: boolean): string {
  if (num === '' || num === '-') return '';
  const n = parseFloat(num);
  if (Number.isNaN(n)) return '';
  if (!allowNegative && n < 0) return '0px';
  return `${n}px`;
}

interface BoxRowProps {
  box: Box;
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

const BoxRow: React.FC<BoxRowProps> = ({ box, target, styleEdit }) => {
  const seed = React.useMemo(
    () => SIDES.map((s) => strip(read(target, box, s))) as [string, string, string, string],
    [target, box],
  );
  const [vals, setVals] = React.useState(seed);
  const [linked, setLinked] = React.useState(false);

  React.useEffect(() => setVals(seed), [seed]);

  const commit = (idx: number, raw: string) => {
    const allowNeg = box === 'margin';
    const nextVals: [string, string, string, string] = linked
      ? [raw, raw, raw, raw]
      : ([...vals.slice(0, idx), raw, ...vals.slice(idx + 1)] as [string, string, string, string]);
    setVals(nextVals);

    const formatted = format(raw, allowNeg);
    if (formatted === '') return;
    if (linked) {
      SIDES.forEach((s) => styleEdit.apply(target, `${box}-${s}`, formatted));
    } else {
      const side = SIDES[idx]!;
      styleEdit.apply(target, `${box}-${side}`, formatted);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="normal-case tracking-normal">{box}</Label>
        <button
          type="button"
          onClick={() => setLinked((v) => !v)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
          aria-pressed={linked}
          title={linked ? 'Unlink sides' : 'Link sides'}
        >
          {linked ? 'linked' : 'free'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {SIDES.map((s, i) => (
          <Input
            key={s}
            type="number"
            value={vals[i]}
            placeholder={s[0]!.toUpperCase()}
            title={s}
            onChange={(e) => commit(i, e.target.value)}
          />
        ))}
      </div>
    </div>
  );
};

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const SpacingSection = observer(({ target, styleEdit }: Props) => {
  return (
    <div className="flex flex-col gap-2.5">
      <BoxRow box="padding" target={target} styleEdit={styleEdit} />
      <BoxRow box="margin" target={target} styleEdit={styleEdit} />
    </div>
  );
});
SpacingSection.displayName = 'SpacingSection';
