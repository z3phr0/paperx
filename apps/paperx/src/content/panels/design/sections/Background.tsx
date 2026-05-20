/**
 * Background section — three modes (solid / gradient / image) gated by
 * Segmented. Mode is seeded from the current computed style:
 *
 *   - background-image matches a gradient → mode 'gradient'
 *   - background-image is `url(...)`      → mode 'image'
 *   - else                                → mode 'solid'
 *
 * All writes flow through StyleEditService.apply.
 *   solid    → sets `background-color`
 *   gradient → sets `background` (CSS string from gradientToCss)
 *   image    → sets `background-image: url(<input>)`
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Segmented, type SegmentedOption } from '@/shared/ui/Segmented';
import { ColorPicker } from '@/shared/ui/ColorPicker';
import {
  GradientEditor,
  DEFAULT_VALUE as DEFAULT_GRADIENT,
  gradientToCss,
  parseGradientCss,
  type GradientValue,
} from '@/shared/ui/GradientEditor';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

type BgMode = 'solid' | 'gradient' | 'image';

const BG_OPTIONS: ReadonlyArray<SegmentedOption<BgMode>> = [
  { value: 'solid', label: <span data-testid="paperx-bg-type-solid">Solid</span> },
  { value: 'gradient', label: <span data-testid="paperx-bg-type-gradient">Gradient</span> },
  { value: 'image', label: <span data-testid="paperx-bg-type-image">Image</span> },
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

function detectMode(target: HTMLElement): BgMode {
  const img = read(target, 'background-image');
  if (img && img !== 'none') {
    if (/^(linear|radial)-gradient\(/i.test(img)) return 'gradient';
    if (/^url\(/i.test(img)) return 'image';
  }
  return 'solid';
}

function extractUrl(raw: string): string {
  // Accepts `url("...")`, `url('...')`, or `url(...)`.
  const m = raw.match(/^url\(\s*(['"]?)(.+?)\1\s*\)$/);
  return m ? m[2]! : '';
}

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const BackgroundSection = observer(({ target, styleEdit }: Props) => {
  // Hooks-order rule: every hook before any conditional.
  const seedMode = React.useMemo(() => detectMode(target), [target]);
  const colorSeed = React.useMemo(
    () => read(target, 'background-color'),
    [target],
  );
  const gradientSeed = React.useMemo<GradientValue>(() => {
    const img = read(target, 'background-image');
    const parsed = img ? parseGradientCss(img) : null;
    return parsed ?? DEFAULT_GRADIENT;
  }, [target]);
  const urlSeed = React.useMemo(
    () => extractUrl(read(target, 'background-image')),
    [target],
  );

  const [mode, setMode] = React.useState<BgMode>(seedMode);
  const [color, setColor] = React.useState<string>(colorSeed);
  const [gradient, setGradient] = React.useState<GradientValue>(gradientSeed);
  const [imageUrl, setImageUrl] = React.useState<string>(urlSeed);

  React.useEffect(() => setMode(seedMode), [seedMode]);
  React.useEffect(() => setColor(colorSeed), [colorSeed]);
  React.useEffect(() => setGradient(gradientSeed), [gradientSeed]);
  React.useEffect(() => setImageUrl(urlSeed), [urlSeed]);

  const commitGradient = (next: GradientValue) => {
    setGradient(next);
    styleEdit.apply(target, 'background', gradientToCss(next));
  };

  const commitImageUrl = (raw: string) => {
    setImageUrl(raw);
    if (raw.trim() === '') return;
    styleEdit.apply(target, 'background-image', `url("${raw.trim()}")`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="normal-case tracking-normal">Type</Label>
        <Segmented<BgMode>
          value={mode}
          onChange={(next) => setMode(next)}
          options={BG_OPTIONS}
        />
      </div>

      {mode === 'solid' && (
        <div className="flex items-center gap-1.5">
          <Label className="w-16 normal-case tracking-normal">Color</Label>
          <div data-testid="paperx-bg-color-trigger">
            <ColorPicker
              value={color}
              ariaLabel="Pick background color"
              onPreview={(v) => setColor(v)}
              onChange={(v) => {
                setColor(v);
                styleEdit.apply(target, 'background-color', v);
              }}
            />
          </div>
        </div>
      )}

      {mode === 'gradient' && (
        <GradientEditor
          value={gradient}
          onChange={commitGradient}
          onPreview={(next) => setGradient(next)}
        />
      )}

      {mode === 'image' && (
        <div className="flex items-center gap-1.5">
          <Label className="w-16 normal-case tracking-normal">URL</Label>
          <Input
            data-testid="paperx-bg-image-input"
            type="text"
            placeholder="https://example.com/image.png"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.currentTarget.value)}
            onBlur={(e) => commitImageUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitImageUrl((e.target as HTMLInputElement).value);
              }
            }}
            className="flex-1"
          />
        </div>
      )}
    </div>
  );
});
BackgroundSection.displayName = 'BackgroundSection';
