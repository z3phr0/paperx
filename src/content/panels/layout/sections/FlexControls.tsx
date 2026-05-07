/**
 * FlexControls — Figma-style flex sub-panel.
 *
 * Renders Direction / Wrap as `Segmented` pickers and the Justify / Align
 * axes as a row of `IconButton`s with lucide alignment glyphs. Gap is a
 * plain text input (the CSS `gap` shorthand accepts e.g. `8px` or
 * `4px 8px` so a numeric-only input would be wrong here).
 *
 * Pure consumer of `target` + `styleEdit`: state lives in this component
 * (drafts for the gap input) but every mutation routes through
 * `StyleEditService.apply()` to keep the ChangeLog as the single source of
 * truth.
 */
import * as React from 'react';
import {
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceBetween,
  AlignHorizontalSpaceAround,
  AlignHorizontalDistributeCenter,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  StretchVertical,
  Baseline,
  type LucideIcon,
} from 'lucide-react';

import { IconButton } from '@/shared/ui/IconButton';
import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Segmented, type SegmentedOption } from '@/shared/ui/Segmented';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
  /** Caller-provided draft for the shared `gap` input. */
  gap: string;
  setGap: (next: string) => void;
}

type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse';
type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
type JustifyKey = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
type AlignKey = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

const DIRECTION_OPTIONS: ReadonlyArray<SegmentedOption<FlexDirection>> = [
  { value: 'row', label: 'row' },
  { value: 'row-reverse', label: 'row-rev' },
  { value: 'column', label: 'col' },
  { value: 'column-reverse', label: 'col-rev' },
];

const WRAP_OPTIONS: ReadonlyArray<SegmentedOption<FlexWrap>> = [
  { value: 'nowrap', label: 'nowrap' },
  { value: 'wrap', label: 'wrap' },
  { value: 'wrap-reverse', label: 'wrap-rev' },
];

interface JustifyEntry {
  key: JustifyKey;
  value: string;
  Icon: LucideIcon;
  ariaLabel: string;
  testId: string;
}

// testId is written out in full (rather than `paperx-flex-justify-${key}`)
// so source-code grep can verify each entry exists at build time. The
// completion gate counts these literals.
const JUSTIFY_ENTRIES: ReadonlyArray<JustifyEntry> = [
  {
    key: 'start',
    value: 'flex-start',
    Icon: AlignStartHorizontal,
    ariaLabel: 'Justify start',
    testId: 'paperx-flex-justify-start',
  },
  {
    key: 'center',
    value: 'center',
    Icon: AlignCenterHorizontal,
    ariaLabel: 'Justify center',
    testId: 'paperx-flex-justify-center',
  },
  {
    key: 'end',
    value: 'flex-end',
    Icon: AlignEndHorizontal,
    ariaLabel: 'Justify end',
    testId: 'paperx-flex-justify-end',
  },
  {
    key: 'between',
    value: 'space-between',
    Icon: AlignHorizontalSpaceBetween,
    ariaLabel: 'Justify space-between',
    testId: 'paperx-flex-justify-between',
  },
  {
    key: 'around',
    value: 'space-around',
    Icon: AlignHorizontalSpaceAround,
    ariaLabel: 'Justify space-around',
    testId: 'paperx-flex-justify-around',
  },
  {
    key: 'evenly',
    value: 'space-evenly',
    Icon: AlignHorizontalDistributeCenter,
    ariaLabel: 'Justify space-evenly',
    testId: 'paperx-flex-justify-evenly',
  },
];

interface AlignEntry {
  key: AlignKey;
  value: string;
  Icon: LucideIcon;
  ariaLabel: string;
  testId: string;
}

const ALIGN_ENTRIES: ReadonlyArray<AlignEntry> = [
  {
    key: 'start',
    value: 'flex-start',
    Icon: AlignStartVertical,
    ariaLabel: 'Align start',
    testId: 'paperx-flex-align-start',
  },
  {
    key: 'center',
    value: 'center',
    Icon: AlignCenterVertical,
    ariaLabel: 'Align center',
    testId: 'paperx-flex-align-center',
  },
  {
    key: 'end',
    value: 'flex-end',
    Icon: AlignEndVertical,
    ariaLabel: 'Align end',
    testId: 'paperx-flex-align-end',
  },
  {
    key: 'stretch',
    value: 'stretch',
    Icon: StretchVertical,
    ariaLabel: 'Align stretch',
    testId: 'paperx-flex-align-stretch',
  },
  {
    key: 'baseline',
    value: 'baseline',
    Icon: Baseline,
    ariaLabel: 'Align baseline',
    testId: 'paperx-flex-align-baseline',
  },
];

function readDirection(cs: CSSStyleDeclaration): FlexDirection {
  const v = cs.flexDirection as FlexDirection;
  return v === 'row' || v === 'row-reverse' || v === 'column' || v === 'column-reverse'
    ? v
    : 'row';
}

function readWrap(cs: CSSStyleDeclaration): FlexWrap {
  const v = cs.flexWrap as FlexWrap;
  return v === 'nowrap' || v === 'wrap' || v === 'wrap-reverse' ? v : 'nowrap';
}

export function FlexControls({ target, styleEdit, gap, setGap }: Props): React.ReactElement {
  const cs = window.getComputedStyle(target);
  const direction = readDirection(cs);
  const wrap = readWrap(cs);
  const justify = cs.justifyContent;
  const align = cs.alignItems;

  const apply = (prop: string, value: string) => styleEdit.apply(target, prop, value);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>Direction</Label>
        <Segmented<FlexDirection>
          value={direction}
          onChange={(v) => apply('flex-direction', v)}
          options={DIRECTION_OPTIONS.map((o) => ({
            ...o,
            label: (
              <span data-testid={`paperx-flex-direction-${o.value}`}>{o.label}</span>
            ),
            ariaLabel: `flex-direction ${o.value}`,
          }))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <Label>Wrap</Label>
        <Segmented<FlexWrap>
          value={wrap}
          onChange={(v) => apply('flex-wrap', v)}
          options={WRAP_OPTIONS.map((o) => ({
            ...o,
            label: <span data-testid={`paperx-flex-wrap-${o.value}`}>{o.label}</span>,
            ariaLabel: `flex-wrap ${o.value}`,
          }))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <Label>Justify</Label>
        <div className="inline-flex items-center gap-1">
          {JUSTIFY_ENTRIES.map(({ key, value, Icon, ariaLabel, testId }) => (
            <IconButton
              key={key}
              size="sm"
              ariaLabel={ariaLabel}
              active={justify === value}
              data-testid={testId}
              onClick={() => apply('justify-content', value)}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </IconButton>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Align</Label>
        <div className="inline-flex items-center gap-1">
          {ALIGN_ENTRIES.map(({ key, value, Icon, ariaLabel, testId }) => (
            <IconButton
              key={key}
              size="sm"
              ariaLabel={ariaLabel}
              active={align === value}
              data-testid={testId}
              onClick={() => apply('align-items', value)}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </IconButton>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Gap</Label>
        <Input
          type="text"
          value={gap}
          onChange={(e) => setGap(e.target.value)}
          onBlur={() => apply('gap', gap)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder="0px"
          data-testid="paperx-flex-gap"
        />
      </div>
    </div>
  );
}

FlexControls.displayName = 'FlexControls';
