/**
 * RulerPanel — read-only measurement readout for the selected element.
 *
 * Visible iff `mode === 'ruler' && selected != null`. Shows the
 * bounding rect (x/y/width/height), distances from the four viewport
 * edges, and (when applicable) computed margin / padding boxes.
 *
 * No StyleEditService — ruler mode is observation only. Edits belong
 * in design mode.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Card, CardHeader, CardContent } from '@/shared/ui/Card';
import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import { buildSelector } from '@/shared/types/changes';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
}

interface RowProps {
  label: string;
  value: string;
}
function Row({ label, value }: RowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

const px = (n: number): string => `${Math.round(n * 100) / 100}px`;

export const RulerPanel = observer(({ uiStore, selectionStore }: Props) => {
  const visible =
    uiStore.visible && uiStore.mode === 'ruler' && selectionStore.selected != null;
  if (!visible) return null;

  const target = selectionStore.selected!;
  const rect = selectionStore.selectedRect ?? target.getBoundingClientRect();
  const cs = window.getComputedStyle(target);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return (
    <aside
      role="complementary"
      aria-label="paperx ruler panel"
      data-testid="paperx-ruler-panel"
      className="fixed right-4 top-14 bottom-4 z-[2147483640] w-[280px] overflow-y-auto rounded-lg border bg-background p-2 text-foreground shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="mb-2 px-1 pt-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Selection
        </div>
        <div className="truncate font-mono text-[11px]">{buildSelector(target)}</div>
      </header>

      <Card className="mb-2">
        <CardHeader className="text-[10px] uppercase">Bounding box</CardHeader>
        <CardContent className="space-y-0">
          <Row label="X" value={px(rect.x)} />
          <Row label="Y" value={px(rect.y)} />
          <Row label="Width" value={px(rect.width)} />
          <Row label="Height" value={px(rect.height)} />
        </CardContent>
      </Card>

      <Card className="mb-2">
        <CardHeader className="text-[10px] uppercase">Viewport offsets</CardHeader>
        <CardContent className="space-y-0">
          <Row label="From top" value={px(rect.top)} />
          <Row label="From left" value={px(rect.left)} />
          <Row label="From right" value={px(vw - rect.right)} />
          <Row label="From bottom" value={px(vh - rect.bottom)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-[10px] uppercase">Computed box</CardHeader>
        <CardContent className="space-y-0">
          <Row label="Padding" value={`${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`} />
          <Row label="Margin" value={`${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`} />
          <Row label="Border" value={cs.borderWidth} />
        </CardContent>
      </Card>
    </aside>
  );
});
RulerPanel.displayName = 'RulerPanel';
