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
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Card, CardHeader, CardContent } from '@/shared/ui/Card';
import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { buildSelector } from '@/shared/types/changes';

import { SizeSection } from './sections/Size';
import { TypographySection } from './sections/Typography';
import { SpacingSection } from './sections/Spacing';
import { PositionSection } from './sections/Position';
import { LayoutSection } from './sections/Layout';

interface SectionConfig {
  id: string;
  title: string;
  render: (target: HTMLElement, styleEdit: IStyleEditService) => React.ReactNode;
}

const SECTIONS: readonly SectionConfig[] = [
  { id: 'size', title: 'Size', render: (t, s) => <SizeSection target={t} styleEdit={s} /> },
  { id: 'typography', title: 'Typography', render: (t, s) => <TypographySection target={t} styleEdit={s} /> },
  { id: 'spacing', title: 'Spacing', render: (t, s) => <SpacingSection target={t} styleEdit={s} /> },
  { id: 'position', title: 'Position', render: (t, s) => <PositionSection target={t} styleEdit={s} /> },
  { id: 'layout', title: 'Layout', render: (t, s) => <LayoutSection target={t} styleEdit={s} /> },
];

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  styleEdit: IStyleEditService;
}

export const DesignPanel = observer(({ uiStore, selectionStore, styleEdit }: Props) => {
  const visible = uiStore.visible && uiStore.mode === 'design' && selectionStore.selected != null;
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const toggle = (id: string) => setCollapsed((m) => ({ ...m, [id]: !m[id] }));

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
        width: '280px',
      }}
      // Stop host-page hotkeys / picker click handlers from firing while
      // the user interacts with our inputs. We don't preventDefault — the
      // panel still needs native focus/keyboard semantics.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="flex flex-col gap-0.5 border-b px-1 pb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        {SECTIONS.map((sec) => {
          const isCollapsed = collapsed[sec.id] === true;
          return (
            <Card key={sec.id}>
              <CardHeader
                role="button"
                tabIndex={0}
                onClick={() => toggle(sec.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(sec.id);
                  }
                }}
                className="cursor-pointer select-none hover:bg-accent"
              >
                <span>{sec.title}</span>
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </CardHeader>
              {!isCollapsed && <CardContent>{sec.render(target, styleEdit)}</CardContent>}
            </Card>
          );
        })}
      </div>
    </div>
  );
});
DesignPanel.displayName = 'DesignPanel';
