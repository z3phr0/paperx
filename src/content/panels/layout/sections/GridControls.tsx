/**
 * GridControls — Figma-style grid sub-panel.
 *
 * Exposes the four properties that drive a CSS grid container: column /
 * row track templates, auto-flow direction (with a `dense` toggle), the
 * shared `gap` shorthand, and the `grid-template-areas` raw string. The
 * areas textarea is monospace + 3-row tall so multi-row templates are
 * legible.
 *
 * State for input drafts lives locally (so each keystroke doesn't fire a
 * StyleEditService.apply / ChangeLog entry); the apply happens on blur or
 * Enter, mirroring the convention used by the existing layout panel.
 */
import * as React from 'react';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Segmented, type SegmentedOption } from '@/shared/ui/Segmented';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { formatLengthPx } from '@/shared/types/numeric';

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
  /** Caller-provided draft for the shared `gap` input. */
  gap: string;
  setGap: (next: string) => void;
}

type AutoFlow = 'row' | 'column' | 'dense';

const AUTO_FLOW_OPTIONS: ReadonlyArray<SegmentedOption<AutoFlow>> = [
  { value: 'row', label: 'row' },
  { value: 'column', label: 'column' },
  { value: 'dense', label: 'dense' },
];

function readGridFlow(cs: CSSStyleDeclaration): AutoFlow {
  const raw = (cs.gridAutoFlow || 'row').trim();
  if (raw.includes('dense')) return 'dense';
  if (raw.startsWith('column')) return 'column';
  return 'row';
}

export function GridControls({ target, styleEdit, gap, setGap }: Props): React.ReactElement {
  const cs = window.getComputedStyle(target);
  const seedCols = (cs.gridTemplateColumns === 'none' ? '' : cs.gridTemplateColumns) || '';
  const seedRows = (cs.gridTemplateRows === 'none' ? '' : cs.gridTemplateRows) || '';
  const seedAreas = cs.gridTemplateAreas === 'none' ? '' : cs.gridTemplateAreas || '';
  const seedFlow = readGridFlow(cs);

  // Local drafts: typed input only writes on blur/Enter so we don't pile
  // a ChangeLog entry per keystroke. Drafts re-seed when the target swaps.
  const [colsDraft, setColsDraft] = React.useState(seedCols);
  const [rowsDraft, setRowsDraft] = React.useState(seedRows);
  const [areasDraft, setAreasDraft] = React.useState(seedAreas);

  React.useEffect(() => setColsDraft(seedCols), [seedCols, target]);
  React.useEffect(() => setRowsDraft(seedRows), [seedRows, target]);
  React.useEffect(() => setAreasDraft(seedAreas), [seedAreas, target]);

  const apply = (prop: string, value: string) => styleEdit.apply(target, prop, value);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>Cols</Label>
        <Input
          type="text"
          value={colsDraft}
          onChange={(e) => setColsDraft(e.target.value)}
          onBlur={() => apply('grid-template-columns', colsDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder="1fr 1fr"
          data-testid="paperx-grid-template-cols"
        />
      </div>

      <div className="space-y-1">
        <Label>Rows</Label>
        <Input
          type="text"
          value={rowsDraft}
          onChange={(e) => setRowsDraft(e.target.value)}
          onBlur={() => apply('grid-template-rows', rowsDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder="auto"
          data-testid="paperx-grid-template-rows"
        />
      </div>

      <div className="space-y-1">
        <Label>Auto Flow</Label>
        <Segmented<AutoFlow>
          value={seedFlow}
          onChange={(v) => apply('grid-auto-flow', v === 'dense' ? 'row dense' : v)}
          options={AUTO_FLOW_OPTIONS.map((o) => ({
            ...o,
            label: (
              <span data-testid={`paperx-grid-auto-flow-${o.value}`}>{o.label}</span>
            ),
            ariaLabel: `grid-auto-flow ${o.value}`,
          }))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <Label>Gap</Label>
        <Input
          type="text"
          value={gap}
          onChange={(e) => setGap(e.target.value)}
          onBlur={() => {
            const formatted = formatLengthPx(gap);
            if (formatted != null) apply('gap', formatted);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder="0px"
          data-testid="paperx-grid-gap"
        />
      </div>

      <div className="space-y-1">
        <Label>Areas</Label>
        <textarea
          value={areasDraft}
          onChange={(e) => setAreasDraft(e.target.value)}
          onBlur={() => apply('grid-template-areas', areasDraft)}
          rows={3}
          placeholder={'"head head"\n"nav main"\n"foot foot"'}
          data-testid="paperx-grid-areas-textarea"
          className="flex w-full resize-y rounded-sm border border-input bg-background px-2 py-1 font-mono text-[11px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}

GridControls.displayName = 'GridControls';
