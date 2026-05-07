/**
 * Layout section — display + flex/grid sub-controls.
 *
 * Sub-controls (flex-direction / justify-content / align-items / gap) are
 * only rendered when `display` is flex or grid, mirroring Figma's
 * progressive-disclosure UX.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Select } from '@/shared/ui/Select';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

const DISPLAY_OPTIONS = [
  { value: 'block', label: 'block' },
  { value: 'inline', label: 'inline' },
  { value: 'inline-block', label: 'inline-block' },
  { value: 'flex', label: 'flex' },
  { value: 'inline-flex', label: 'inline-flex' },
  { value: 'grid', label: 'grid' },
  { value: 'inline-grid', label: 'inline-grid' },
  { value: 'none', label: 'none' },
];

const FLEX_DIRECTION_OPTIONS = [
  { value: 'row', label: 'row' },
  { value: 'row-reverse', label: 'row-reverse' },
  { value: 'column', label: 'column' },
  { value: 'column-reverse', label: 'column-reverse' },
];

const JUSTIFY_OPTIONS = [
  { value: 'flex-start', label: 'flex-start' },
  { value: 'flex-end', label: 'flex-end' },
  { value: 'center', label: 'center' },
  { value: 'space-between', label: 'space-between' },
  { value: 'space-around', label: 'space-around' },
  { value: 'space-evenly', label: 'space-evenly' },
];

const ALIGN_OPTIONS = [
  { value: 'stretch', label: 'stretch' },
  { value: 'flex-start', label: 'flex-start' },
  { value: 'flex-end', label: 'flex-end' },
  { value: 'center', label: 'center' },
  { value: 'baseline', label: 'baseline' },
];

function read(target: HTMLElement, prop: string): string {
  const inline = target.style.getPropertyValue(prop);
  if (inline) return inline;
  try {
    return getComputedStyle(target).getPropertyValue(prop) ?? '';
  } catch {
    return '';
  }
}

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const LayoutSection = observer(({ target, styleEdit }: Props) => {
  const seedDisplay = React.useMemo(() => read(target, 'display').trim() || 'block', [target]);
  const seedDir = React.useMemo(() => read(target, 'flex-direction').trim() || 'row', [target]);
  const seedJustify = React.useMemo(
    () => read(target, 'justify-content').trim() || 'flex-start',
    [target],
  );
  const seedAlign = React.useMemo(() => read(target, 'align-items').trim() || 'stretch', [target]);
  const seedGap = React.useMemo(() => {
    const v = read(target, 'gap').trim();
    const m = v.match(/^(-?[\d.]+)px$/);
    return m && m[1] ? m[1] : '';
  }, [target]);

  const [display, setDisplay] = React.useState(seedDisplay);
  const [direction, setDirection] = React.useState(seedDir);
  const [justify, setJustify] = React.useState(seedJustify);
  const [align, setAlign] = React.useState(seedAlign);
  const [gap, setGap] = React.useState(seedGap);

  React.useEffect(() => setDisplay(seedDisplay), [seedDisplay]);
  React.useEffect(() => setDirection(seedDir), [seedDir]);
  React.useEffect(() => setJustify(seedJustify), [seedJustify]);
  React.useEffect(() => setAlign(seedAlign), [seedAlign]);
  React.useEffect(() => setGap(seedGap), [seedGap]);

  const isFlex = display === 'flex' || display === 'inline-flex';
  const isGrid = display === 'grid' || display === 'inline-grid';
  const showFlexControls = isFlex || isGrid;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="w-16 normal-case tracking-normal">Display</Label>
        <Select
          value={display}
          options={DISPLAY_OPTIONS}
          onChange={(e) => {
            setDisplay(e.target.value);
            styleEdit.apply(target, 'display', e.target.value);
          }}
          className="flex-1"
        />
      </div>

      {isFlex && (
        <div className="flex items-center gap-1.5">
          <Label className="w-16 normal-case tracking-normal">Direction</Label>
          <Select
            value={direction}
            options={FLEX_DIRECTION_OPTIONS}
            onChange={(e) => {
              setDirection(e.target.value);
              styleEdit.apply(target, 'flex-direction', e.target.value);
            }}
            className="flex-1"
          />
        </div>
      )}

      {showFlexControls && (
        <>
          <div className="flex items-center gap-1.5">
            <Label className="w-16 normal-case tracking-normal">Justify</Label>
            <Select
              value={justify}
              options={JUSTIFY_OPTIONS}
              onChange={(e) => {
                setJustify(e.target.value);
                styleEdit.apply(target, 'justify-content', e.target.value);
              }}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="w-16 normal-case tracking-normal">Align</Label>
            <Select
              value={align}
              options={ALIGN_OPTIONS}
              onChange={(e) => {
                setAlign(e.target.value);
                styleEdit.apply(target, 'align-items', e.target.value);
              }}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="w-16 normal-case tracking-normal">Gap</Label>
            <Input
              type="number"
              value={gap}
              onChange={(e) => {
                setGap(e.target.value);
                if (e.target.value !== '') {
                  styleEdit.apply(target, 'gap', `${parseFloat(e.target.value)}px`);
                }
              }}
              className="flex-1"
            />
          </div>
        </>
      )}
    </div>
  );
});
LayoutSection.displayName = 'LayoutSection';
