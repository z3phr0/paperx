/**
 * LayoutPanel — container-level structural editor.
 *
 * Visible iff `mode === 'layout' && selected != null`. Surfaces the
 * `display` value as a quick-toggle row plus the most common
 * flex/grid props. Writes go through StyleEditService so every change
 * shows up in the ChangeLog like any design-mode edit.
 *
 * Differs from design/sections/Layout in scope: design's section is
 * one of five panels and shares its panel real estate with sibling
 * sections. This panel is the focused tool when a reviewer is
 * specifically auditing layout structure.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Button } from '@/shared/ui/button';
import { Card, CardHeader, CardContent } from '@/shared/ui/Card';
import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { buildSelector } from '@/shared/types/changes';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  styleEdit: IStyleEditService;
}

const DISPLAY_OPTIONS = ['block', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid'] as const;
const FLEX_DIRECTIONS = ['row', 'row-reverse', 'column', 'column-reverse'] as const;
const JUSTIFY_OPTIONS = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] as const;
const ALIGN_OPTIONS = ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'] as const;

interface RowProps {
  label: string;
  options: readonly string[];
  current: string;
  onPick: (v: string) => void;
}
function ToggleRow({ label, options, current, onPick }: RowProps): React.ReactElement {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = current === opt;
          return (
            <Button
              key={opt}
              variant={active ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPick(opt)}
              className="h-6 px-2 text-[10px]"
            >
              {opt}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export const LayoutPanel = observer(
  ({ uiStore, selectionStore, styleEdit }: Props) => {
    // Hook order MUST stay stable across renders, so call hooks before
    // any early return. The render body further down handles the
    // null-target case after the visibility gate.
    const target = selectionStore.selected;
    const csGap = target ? window.getComputedStyle(target).gap || '0px' : '0px';
    const [gapDraft, setGapDraft] = React.useState(csGap);
    React.useEffect(() => {
      setGapDraft(csGap);
    }, [csGap, target]);

    const visible =
      uiStore.visible && uiStore.mode === 'layout' && target != null;
    if (!visible || !target) return null;

    const cs = window.getComputedStyle(target);
    const display = cs.display;
    const isFlexLike = display === 'flex' || display === 'inline-flex';
    const isGridLike = display === 'grid' || display === 'inline-grid';

    const apply = (prop: string, value: string) => styleEdit.apply(target, prop, value);

    return (
      <aside
        role="complementary"
        aria-label="paperx layout panel"
        data-testid="paperx-layout-panel"
        className="paperx-surface fixed right-4 top-14 bottom-4 z-[2147483640] w-[280px] overflow-y-auto rounded-lg p-2"
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
          <CardHeader className="text-[10px] uppercase">Display</CardHeader>
          <CardContent>
            <ToggleRow
              label="display"
              options={DISPLAY_OPTIONS}
              current={display}
              onPick={(v) => apply('display', v)}
            />
          </CardContent>
        </Card>

        {isFlexLike && (
          <Card className="mb-2">
            <CardHeader className="text-[10px] uppercase">Flex</CardHeader>
            <CardContent className="space-y-2">
              <ToggleRow
                label="direction"
                options={FLEX_DIRECTIONS}
                current={cs.flexDirection}
                onPick={(v) => apply('flex-direction', v)}
              />
              <ToggleRow
                label="justify"
                options={JUSTIFY_OPTIONS}
                current={cs.justifyContent}
                onPick={(v) => apply('justify-content', v)}
              />
              <ToggleRow
                label="align"
                options={ALIGN_OPTIONS}
                current={cs.alignItems}
                onPick={(v) => apply('align-items', v)}
              />
            </CardContent>
          </Card>
        )}

        {(isFlexLike || isGridLike) && (
          <Card>
            <CardHeader className="text-[10px] uppercase">Gap</CardHeader>
            <CardContent>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={gapDraft}
                  onChange={(e) => setGapDraft(e.target.value)}
                  onBlur={() => apply('gap', gapDraft)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-20 rounded border bg-background px-1.5 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                  placeholder="0px"
                />
                <span className="text-[10px] text-muted-foreground">e.g. 8px or 4px 8px</span>
              </div>
            </CardContent>
          </Card>
        )}
      </aside>
    );
  },
);
LayoutPanel.displayName = 'LayoutPanel';
