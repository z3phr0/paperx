/**
 * LayoutPanel — container-level structural editor (Figma-style).
 *
 * Visible iff `mode === 'layout' && selected != null`. The panel surfaces
 * `display` as a quick-toggle button row; when the chosen value is
 * flex-like or grid-like the corresponding sub-panel renders below.
 * Writes go through StyleEditService so every change shows up in the
 * ChangeLog.
 *
 * Why plain `<Button>` for the Display row instead of Segmented:
 * Radix `ToggleGroup` items render with `role="radio"` (not `button`)
 * when `type="single"`. The Sprint-3 e2e at
 * `tests/e2e/paperx-sanity.spec.ts:491` reaches for the flex toggle via
 * `getByRole('button', { name: 'flex', exact: true })` — a radio role
 * would fail the lookup. Using plain Buttons keeps the e2e green and
 * preserves the visual pill-row look. Inner sub-panels (Flex / Grid)
 * still use Segmented for their direction / wrap / auto-flow controls,
 * since those aren't gated by a button-role e2e.
 *
 * Hooks-order rule (see CLAUDE.md): every useState / useEffect MUST run
 * BEFORE any conditional return. The `gap` draft state lives on this
 * root component and is shared with both Flex and Grid sub-panels (both
 * write the same CSS `gap` property), so the hook count stays stable
 * across renders even when the target is null.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Button } from '@/shared/ui/button';
import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { buildSelector } from '@/shared/types/changes';

import { FlexControls } from './sections/FlexControls';
import { GridControls } from './sections/GridControls';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  styleEdit: IStyleEditService;
}

type DisplayValue =
  | 'block'
  | 'inline-block'
  | 'flex'
  | 'inline-flex'
  | 'grid'
  | 'inline-grid';

// `flex` button MUST render with accessible name exactly 'flex' (the
// label text doubles as the accessible name on a plain <button>).
const DISPLAY_OPTIONS: ReadonlyArray<DisplayValue> = [
  'block',
  'inline-block',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
];

function coerceDisplay(raw: string): DisplayValue {
  switch (raw) {
    case 'block':
    case 'inline-block':
    case 'flex':
    case 'inline-flex':
    case 'grid':
    case 'inline-grid':
      return raw;
    default:
      return 'block';
  }
}

export const LayoutPanel = observer(
  ({ uiStore, selectionStore, styleEdit }: Props) => {
    // Hook order MUST stay stable across renders, so call hooks before
    // any early return. Target may be null; reads use a `'0px'` default.
    const target = selectionStore.selected;
    const csGap = target ? window.getComputedStyle(target).gap || '0px' : '0px';
    const [gapDraft, setGapDraft] = React.useState(csGap);
    React.useEffect(() => {
      setGapDraft(csGap);
    }, [csGap, target]);

    // Local display draft so the panel re-renders when the user clicks a
    // display button. styleEdit.apply mutates inline style directly but
    // window.getComputedStyle reads aren't MobX-observable, so without a
    // local state there'd be no signal to re-mount Flex/Grid sub-panels.
    const csDisplay = target
      ? coerceDisplay(window.getComputedStyle(target).display)
      : 'block';
    const [display, setDisplay] = React.useState<DisplayValue>(csDisplay);
    React.useEffect(() => {
      setDisplay(csDisplay);
    }, [csDisplay, target]);

    const visible =
      uiStore.visible && uiStore.mode === 'layout' && target != null;
    if (!visible || !target) return null;

    const isFlexLike = display === 'flex' || display === 'inline-flex';
    const isGridLike = display === 'grid' || display === 'inline-grid';

    return (
      <aside
        role="complementary"
        aria-label="paperx layout panel"
        data-testid="paperx-layout-panel"
        className="paperx-surface fixed right-4 top-14 bottom-4 z-[2147483640] w-[400px] overflow-y-auto rounded-lg p-2"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-2 px-1 pt-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Selection
          </div>
          <div className="truncate font-mono text-[11px]">
            {buildSelector(target)}
          </div>
        </header>

        <section className="mb-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Display
          </div>
          <div className="flex flex-wrap gap-1">
            {DISPLAY_OPTIONS.map((opt) => {
              const active = display === opt;
              return (
                <Button
                  key={opt}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setDisplay(opt);
                    styleEdit.apply(target, 'display', opt);
                  }}
                  className="h-6 px-2 text-[10px]"
                  data-testid={`paperx-layout-display-${opt}`}
                >
                  {opt}
                </Button>
              );
            })}
          </div>
        </section>

        {isFlexLike && (
          <section className="mb-3">
            <FlexControls
              target={target}
              styleEdit={styleEdit}
              gap={gapDraft}
              setGap={setGapDraft}
            />
          </section>
        )}

        {isGridLike && (
          <section className="mb-3">
            <GridControls
              target={target}
              styleEdit={styleEdit}
              gap={gapDraft}
              setGap={setGapDraft}
            />
          </section>
        )}
      </aside>
    );
  },
);
LayoutPanel.displayName = 'LayoutPanel';
