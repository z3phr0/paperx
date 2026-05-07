/**
 * Border section — width / style / color, applied to all four sides at
 * once via the `border` shorthand.
 *
 * The "link toggle" is implicitly always-on for Sprint 3: width/style/
 * color always broadcast to all 4 sides. Per-side editing is a future
 * enhancement (see task spec).
 *
 * Writes go through StyleEditService.apply on commit only; segmented and
 * width inputs commit immediately on change, color commits on the
 * picker's onChange (live drag is preview-only).
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { ColorPicker } from '@/shared/ui/ColorPicker';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { pxToInt, formatLengthPx } from '@/shared/types/numeric';

type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted' | 'double';

const STYLE_OPTIONS: ReadonlyArray<BorderStyle> = [
  'solid',
  'dashed',
  'dotted',
  'none',
  'double',
];

function read(target: HTMLElement, prop: string): string {
  // Read seed values via getComputedStyle only — StyleEditService owns
  // inline mutations, so we never reach into the inline declaration here.
  try {
    return (getComputedStyle(target).getPropertyValue(prop) ?? '').trim();
  } catch {
    return '';
  }
}

function coerceStyle(raw: string): BorderStyle {
  switch (raw) {
    case 'none':
    case 'solid':
    case 'dashed':
    case 'dotted':
    case 'double':
      return raw;
    default:
      return 'solid';
  }
}

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const BorderSection = observer(({ target, styleEdit }: Props) => {
  // Hooks-order rule: every hook before any conditional.
  const widthSeed = React.useMemo(
    () => pxToInt(read(target, 'border-top-width')),
    [target],
  );
  const styleSeed = React.useMemo(
    () => coerceStyle(read(target, 'border-top-style') || 'solid'),
    [target],
  );
  const colorSeed = React.useMemo(
    () => read(target, 'border-top-color') || '#000000',
    [target],
  );

  const [width, setWidth] = React.useState<string>(widthSeed);
  const [borderStyle, setBorderStyle] = React.useState<BorderStyle>(styleSeed);
  const [color, setColor] = React.useState<string>(colorSeed);

  React.useEffect(() => setWidth(widthSeed), [widthSeed]);
  React.useEffect(() => setBorderStyle(styleSeed), [styleSeed]);
  React.useEffect(() => setColor(colorSeed), [colorSeed]);

  const commitWidth = (raw: string) => {
    setWidth(raw);
    if (raw.trim() === '') return;
    const formatted = formatLengthPx(raw, { allowNegative: false });
    if (formatted == null) return;
    styleEdit.apply(target, 'border-width', formatted);
  };

  const commitStyle = (next: BorderStyle) => {
    setBorderStyle(next);
    styleEdit.apply(target, 'border-style', next);
  };

  const commitColor = (next: string) => {
    setColor(next);
    styleEdit.apply(target, 'border-color', next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="w-16 normal-case tracking-normal">Width</Label>
        <Input
          data-testid="paperx-border-width"
          type="number"
          min={0}
          value={width}
          placeholder="0"
          onChange={(e) => commitWidth(e.currentTarget.value)}
          className="flex-1"
        />
      </div>

      <div className="flex items-start gap-1.5">
        <Label className="mt-1 w-16 normal-case tracking-normal">Style</Label>
        <div className="flex flex-1 flex-wrap gap-1">
          {STYLE_OPTIONS.map((opt) => {
            const active = borderStyle === opt;
            return (
              <button
                key={opt}
                type="button"
                data-testid={`paperx-border-style-${opt}`}
                aria-pressed={active}
                onClick={() => commitStyle(opt)}
                className={
                  'inline-flex h-6 min-w-[42px] items-center justify-center rounded-sm border px-1.5 text-[10px] font-medium transition-colors ' +
                  (active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground')
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Label className="w-16 normal-case tracking-normal">Color</Label>
        <div data-testid="paperx-border-color-trigger">
          <ColorPicker
            value={color}
            ariaLabel="Pick border color"
            onPreview={(v) => setColor(v)}
            onChange={commitColor}
          />
        </div>
      </div>
    </div>
  );
});
BorderSection.displayName = 'BorderSection';
