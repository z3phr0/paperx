/**
 * Typography section — font-family / font-size / font-weight /
 * line-height / letter-spacing / color.
 *
 * `font-family` uses a <datalist> so the user can pick a system font from
 * a curated list or type a custom one.
 *
 * Color is shown as a hex/string text input next to a tiny preview swatch.
 * We don't ship a color picker UI yet — the goal is "good enough for
 * Phase 2 demo"; a Radix Popover-backed picker can land later (when it
 * does, it MUST receive `container={usePortalContainer()}`).
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

const FONT_FAMILY_PRESETS = [
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
  'Inter',
  'Helvetica Neue',
  'Roboto',
];

function readComputed(target: HTMLElement, prop: string): string {
  const inline = target.style.getPropertyValue(prop);
  if (inline) return inline;
  try {
    return getComputedStyle(target).getPropertyValue(prop) ?? '';
  } catch {
    return '';
  }
}

interface FieldProps {
  label: string;
  prop: string;
  target: HTMLElement;
  styleEdit: IStyleEditService;
  type?: 'text' | 'number';
  list?: string;
  className?: string;
}

const Field: React.FC<FieldProps> = ({ label, prop, target, styleEdit, type = 'text', list, className }) => {
  const seed = React.useMemo(() => readComputed(target, prop).trim(), [target, prop]);
  const [val, setVal] = React.useState(seed);

  React.useEffect(() => setVal(seed), [seed]);

  const commit = (v: string) => {
    if (v === '') return; // empty doesn't mean "remove" — could be mid-edit
    styleEdit.apply(target, prop, v);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Label className="w-16 normal-case tracking-normal">{label}</Label>
      <Input
        type={type}
        value={val}
        list={list}
        onChange={(e) => {
          setVal(e.target.value);
          commit(e.target.value);
        }}
        className={className ?? 'flex-1'}
      />
    </div>
  );
};

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const TypographySection = observer(({ target, styleEdit }: Props) => {
  const colorSeed = React.useMemo(() => readComputed(target, 'color').trim(), [target]);
  const [color, setColor] = React.useState(colorSeed);
  React.useEffect(() => setColor(colorSeed), [colorSeed]);

  return (
    <div className="flex flex-col gap-1.5">
      <datalist id="paperx-font-family">
        {FONT_FAMILY_PRESETS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <Field
        label="Family"
        prop="font-family"
        target={target}
        styleEdit={styleEdit}
        list="paperx-font-family"
      />
      <Field label="Size" prop="font-size" target={target} styleEdit={styleEdit} />
      <Field label="Weight" prop="font-weight" target={target} styleEdit={styleEdit} type="number" />
      <Field label="Line H" prop="line-height" target={target} styleEdit={styleEdit} />
      <Field label="Letter" prop="letter-spacing" target={target} styleEdit={styleEdit} />
      <div className="flex items-center gap-1.5">
        <Label className="w-16 normal-case tracking-normal">Color</Label>
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-sm border"
          style={{ background: color || 'transparent' }}
        />
        <Input
          type="text"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            if (e.target.value !== '') styleEdit.apply(target, 'color', e.target.value);
          }}
          className="flex-1"
          placeholder="#000 or rgb(...)"
        />
      </div>
    </div>
  );
});
TypographySection.displayName = 'TypographySection';
