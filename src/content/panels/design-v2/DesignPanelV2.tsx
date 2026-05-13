/**
 * DesignPanelV2 — the Claude-Design-handoff Inspector reborn.
 *
 * Visibility:
 *   - `mode === 'design'`: renders [Design | Inspect] sub-tabs above the
 *     scroll area. Design sub-tab = Frame/Appearance/Fill/Border/Radius;
 *     Inspect sub-tab = BoxModel + CSS/Tailwind/JSX code block.
 *   - `mode === 'ruler'`: same shell, no sub-tab strip — the panel
 *     always shows the Inspect content. Ruler is observation-only so
 *     the editing sub-tab is hidden.
 *
 * In both modes a non-null `SelectionStore.selected` is required.
 * Pixel dimensions / visual identity follow figma-builder/project/
 * paperx-inspector.jsx — 280px width, macOS-glass surface (.dv-
 * inspector).
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

import { FrameSection } from './sections/Frame';
import { AppearanceSection } from './sections/Appearance';
import { FillSection } from './sections/Fill';
import { BorderSectionV2 } from './sections/Border';
import { RadiusSectionV2 } from './sections/Radius';
import { BoxModelDiagram } from './sections/BoxModelDiagram';
import { CodeBlock } from './sections/CodeBlock';

type SubTab = 'design' | 'inspect';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  styleEdit: IStyleEditService;
}

const InspectContent: React.FC<{ target: HTMLElement }> = ({ target }) => (
  <>
    <div className="dv-section">
      <div className="dv-section-header">
        <div className="dv-section-title">Box model</div>
      </div>
      <BoxModelDiagram target={target} />
    </div>
    <CodeBlock target={target} />
  </>
);

export const DesignPanelV2 = observer(({ uiStore, selectionStore, styleEdit }: Props) => {
  const isDesign = uiStore.mode === 'design';
  const isRuler = uiStore.mode === 'ruler';
  const visible =
    uiStore.visible && (isDesign || isRuler) && selectionStore.selected != null;
  const [sub, setSub] = React.useState<SubTab>('design');

  if (!visible) return null;
  const target = selectionStore.selected!;

  // In ruler mode there is no sub-tab strip; the panel is always the
  // Inspect view. In design mode the sub-tab decides the body.
  const showInspect = isRuler || sub === 'inspect';

  return (
    <div
      role="region"
      aria-label="paperx design panel V2"
      data-testid="paperx-v2-panel"
      data-mode={uiStore.mode ?? undefined}
      className="dv-inspector"
      style={{
        position: 'fixed',
        right: '16px',
        // 80px clears the toolbar pill (top-6 right-6 = 24px top, ~44px
        // tall → bottom edge ~68px) with a 12px visual gap.
        top: '80px',
        bottom: '16px',
        zIndex: 2147483646,
        display: 'flex',
        flexDirection: 'column',
        // Hard cap; on shorter viewports the natural top+bottom stretch
        // yields a smaller height and this becomes a no-op.
        maxHeight: '800px',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {isDesign && (
        <div className="dv-tabs">
          {(
            [
              ['design', 'Design'],
              ['inspect', 'Inspect'],
            ] as ReadonlyArray<[SubTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="dv-tab"
              data-active={sub === id || undefined}
              data-testid={`paperx-v2-subtab-${id}`}
              onClick={() => setSub(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        className="dv-scroll"
        style={{ flex: 1, minHeight: 0 }}
        data-testid={`paperx-v2-content-${showInspect ? 'inspect' : 'design'}`}
      >
        {!showInspect && (
          <>
            <FrameSection target={target} styleEdit={styleEdit} />
            <AppearanceSection target={target} styleEdit={styleEdit} />
            <FillSection target={target} styleEdit={styleEdit} />
            <BorderSectionV2 target={target} styleEdit={styleEdit} />
            <RadiusSectionV2 target={target} styleEdit={styleEdit} />
          </>
        )}
        {showInspect && <InspectContent target={target} />}
      </div>
    </div>
  );
});
DesignPanelV2.displayName = 'DesignPanelV2';
