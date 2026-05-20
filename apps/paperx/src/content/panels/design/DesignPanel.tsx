/**
 * DesignPanel — right-side floating drawer (Figma-style) that drives all
 * inline-style edits for the currently selected element.
 *
 * Visibility contract: rendered only when `mode === 'design'` AND
 * `SelectionStore.selected` is non-null. The picker still draws its
 * outline when nothing is selected — they're decoupled on purpose.
 *
 * Width 280px, top 56px (clears toolbar pill), bottom 16px. z-index sits
 * BELOW the toolbar (so the close × is always reachable) and ABOVE the
 * picker overlay.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Card, CardHeader, CardContent } from '@/shared/ui/Card';
import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { buildSelector } from '@/shared/types/changes';

import { BoxModelSection } from './sections/BoxModel';
import { LayoutSection } from './sections/Layout';
import { TypographySection } from './sections/Typography';
import { BackgroundSection } from './sections/Background';
import { BorderSection } from './sections/Border';
import { RadiusSection } from './sections/Radius';

interface SectionConfig {
  id: string;
  title: string;
  // When the section owns its own internal title + action row (e.g.,
  // Border with its `+` button, or Effects with its enable-on-add `+`),
  // set `selfHeader: true` so DesignPanel skips the static CardHeader.
  selfHeader?: boolean;
  render: (target: HTMLElement, styleEdit: IStyleEditService) => React.ReactNode;
}

// Pre-MVP layout: sections are always-on (no chevron / no collapse).
// CardHeader becomes a pure static title row; sections that need a
// right-side action (e.g., Border `+`, Radius `+`) render it themselves
// and opt out of the static header via `selfHeader`.
const SECTIONS: readonly SectionConfig[] = [
  { id: 'boxmodel', title: 'Box model', render: (t, s) => <BoxModelSection target={t} styleEdit={s} /> },
  { id: 'layout', title: 'Layout', render: (t, s) => <LayoutSection target={t} styleEdit={s} /> },
  { id: 'typography', title: 'Typography', render: (t, s) => <TypographySection target={t} styleEdit={s} /> },
  { id: 'background', title: 'Background', render: (t, s) => <BackgroundSection target={t} styleEdit={s} /> },
  { id: 'border', title: 'Border', selfHeader: true, render: (t, s) => <BorderSection target={t} styleEdit={s} /> },
  { id: 'radius', title: 'Radius', selfHeader: true, render: (t, s) => <RadiusSection target={t} styleEdit={s} /> },
];

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  styleEdit: IStyleEditService;
}

export const DesignPanel = observer(({ uiStore, selectionStore, styleEdit }: Props) => {
  const visible = uiStore.visible && uiStore.mode === 'design' && selectionStore.selected != null;

  if (!visible) return null;
  const target = selectionStore.selected!;
  const tag = target.tagName.toLowerCase();
  const summary = buildSelector(target);

  return (
    <div
      role="region"
      aria-label="paperx design panel"
      className="paperx-surface fixed right-4 z-[2147483646] flex flex-col gap-2 overflow-hidden rounded-lg p-2"
      style={{
        top: '56px',
        bottom: '16px',
        width: '400px',
      }}
      // Stop host-page hotkeys / picker click handlers from firing while
      // the user interacts with our inputs. We don't preventDefault — the
      // panel still needs native focus/keyboard semantics.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="flex flex-col gap-0.5 border-b px-1 pb-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground">
          Selection
        </span>
        <span className="truncate text-xs font-mono" title={summary}>
          {`<${tag}>`}
        </span>
        <span className="truncate text-[10px] text-muted-foreground" title={summary}>
          {summary}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {SECTIONS.map((sec) => (
          <Card key={sec.id}>
            {!sec.selfHeader && <CardHeader>{sec.title}</CardHeader>}
            <CardContent>{sec.render(target, styleEdit)}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
});
DesignPanel.displayName = 'DesignPanel';
