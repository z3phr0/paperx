/**
 * Typography section — font-family / font-size / font-weight /
 * line-height / letter-spacing / color.
 *
 * `font-family` uses a <datalist> so the user can pick a system font from
 * a curated list or type a custom one.
 *
 * Color is driven by `<ColorPicker>` (S2-C) — the first production
 * consumer of <PortalProvider>. Important wiring detail re. ChangeLog:
 *
 *   - Live drag (`onPreview`) mutates `target.style.color` directly so
 *     the user sees a tracking preview, but it BYPASSES
 *     StyleEditService — otherwise ChangeLog would record one entry per
 *     drag frame.
 *   - Before committing (`onChange`), we RESTORE the inline color to the
 *     value it had when the popover opened. That way StyleEditService
 *     reads the *original* value as `before` and the ChangeLog ends up
 *     with exactly one record:  before = pre-pick, after = final hex.
 *     Without the restore, `before` would be whatever frame happened to
 *     fire last, often equal to `after` and dropping the record entirely.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { ColorPicker } from '@/shared/ui/ColorPicker';
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

  // Snapshot of the inline-style color at the moment a live-preview drag
  // begins. We need to restore this before committing so
  // StyleEditService reads the correct `before` (otherwise the last drag
  // frame becomes `before` and the commit collapses to a no-op).
  const previewBaselineRef = React.useRef<string | null>(null);

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
        <ColorPicker
          value={color}
          ariaLabel="Pick text color"
          onPreview={(v) => {
            // First preview frame in this pick session — capture the
            // pre-pick inline-color string so we can restore it before
            // commit. We read the inline value (NOT computed), because
            // that's what StyleEditService.readBefore consults first.
            if (previewBaselineRef.current === null) {
              previewBaselineRef.current = target.style.getPropertyValue('color');
            }
            try {
              target.style.setProperty('color', v);
            } catch {
              /* ignore — commit path will surface real failures */
            }
            setColor(v);
            // Revert signal: when the picker dismisses without a commit
            // it calls onPreview with the original raw value. Clear the
            // ref so the next open captures fresh.
            if (v === previewBaselineRef.current) {
              previewBaselineRef.current = null;
            }
          }}
          onChange={(v) => {
            // Restore the pre-pick inline color so StyleEditService sees
            // the right `before`. Empty string => no inline color was
            // set originally; removeProperty mirrors that.
            if (previewBaselineRef.current !== null) {
              try {
                if (previewBaselineRef.current === '') {
                  target.style.removeProperty('color');
                } else {
                  target.style.setProperty('color', previewBaselineRef.current);
                }
              } catch {
                /* ignore */
              }
              previewBaselineRef.current = null;
            }
            setColor(v);
            styleEdit.apply(target, 'color', v);
          }}
        />
      </div>
    </div>
  );
});
TypographySection.displayName = 'TypographySection';
