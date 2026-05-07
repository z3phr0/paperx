/**
 * Size section — width / height with explicit unit selection.
 *
 * UX:
 *   - One <Input> per dimension, paired with a unit <Select> (px / % / auto)
 *   - When the unit is "auto" we write the literal `auto` and disable the
 *     numeric input
 *   - All writes go through StyleEditService.apply (single source of truth)
 *
 * Computed values (`getComputedStyle`) are used to seed the input on
 * selection change so the panel reflects what the user sees, not what the
 * stylesheet declared.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Select } from '@/shared/ui/Select';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

const UNIT_OPTIONS = [
  { value: 'px', label: 'px' },
  { value: '%', label: '%' },
  { value: 'auto', label: 'auto' },
];

type Unit = 'px' | '%' | 'auto';

function parseValue(raw: string): { num: string; unit: Unit } {
  if (!raw || raw === 'auto') return { num: '', unit: 'auto' };
  const m = raw.match(/^(-?[\d.]+)(px|%)$/);
  if (m && m[1] && m[2]) return { num: m[1], unit: m[2] as Unit };
  const n = parseFloat(raw);
  if (!Number.isNaN(n)) return { num: String(n), unit: 'px' };
  return { num: '', unit: 'auto' };
}

function readCurrent(target: HTMLElement, prop: string): string {
  const inline = target.style.getPropertyValue(prop);
  if (inline) return inline;
  try {
    return getComputedStyle(target).getPropertyValue(prop);
  } catch {
    return '';
  }
}

interface DimRowProps {
  label: string;
  prop: 'width' | 'height';
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

const DimRow: React.FC<DimRowProps> = ({ label, prop, target, styleEdit }) => {
  const seed = React.useMemo(() => parseValue(readCurrent(target, prop)), [target, prop]);
  const [num, setNum] = React.useState(seed.num);
  const [unit, setUnit] = React.useState<Unit>(seed.unit);

  React.useEffect(() => {
    setNum(seed.num);
    setUnit(seed.unit);
  }, [seed.num, seed.unit]);

  const commit = (n: string, u: Unit) => {
    if (u === 'auto') {
      styleEdit.apply(target, prop, 'auto');
    } else if (n !== '') {
      styleEdit.apply(target, prop, `${n}${u}`);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Label className="w-10 normal-case tracking-normal">{label}</Label>
      <Input
        type="number"
        value={num}
        disabled={unit === 'auto'}
        onChange={(e) => {
          const v = e.target.value;
          setNum(v);
          commit(v, unit);
        }}
        className="flex-1"
      />
      <Select
        value={unit}
        options={UNIT_OPTIONS}
        onChange={(e) => {
          const u = e.target.value as Unit;
          setUnit(u);
          commit(num, u);
        }}
        className="w-16"
      />
    </div>
  );
};

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const SizeSection = observer(({ target, styleEdit }: Props) => {
  return (
    <div className="flex flex-col gap-1.5">
      <DimRow label="W" prop="width" target={target} styleEdit={styleEdit} />
      <DimRow label="H" prop="height" target={target} styleEdit={styleEdit} />
    </div>
  );
});
SizeSection.displayName = 'SizeSection';
