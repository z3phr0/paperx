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
import { pickPanelPosition, type Bbox } from '@/shared/utils/positionPanel';
import { getHoverTooltipRect } from '@/content/overlays/HoverTooltip';

import { FrameSection } from './sections/Frame';
import { AppearanceSection } from './sections/Appearance';
import { FillSection } from './sections/Fill';
import { BorderSectionV2 } from './sections/Border';
import { RadiusSectionV2 } from './sections/Radius';
import { BoxModelDiagram } from './sections/BoxModelDiagram';
import { CodeBlock } from './sections/CodeBlock';

const PANEL_WIDTH = 280;
const PANEL_MAX_HEIGHT = 800;
const PANEL_GAP = 12;
const PANEL_HANDLE_PAD = 12;
const PANEL_MARGIN = 8;

// Toolbar defaults when uiStore.toolbarPosition is null (Tailwind
// `top-6 right-6`). 24 px from the edge, ~44 px tall pill. The exact
// width is unknown without measuring, but a conservative 320 px keeps
// us safely clear; the actual pill is ~220 px today.
const DEFAULT_TOOLBAR_W = 320;
const DEFAULT_TOOLBAR_H = 48;
const DEFAULT_TOOLBAR_INSET = 24;

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

/** Snapshot the toolbar's bbox from the UIStore position (or its
 *  Tailwind defaults) so the panel can dodge it. */
function toolbarBbox(
  pos: { x: number; y: number } | null,
  viewport: { width: number; height: number },
): Bbox {
  if (pos != null) {
    return {
      left: pos.x,
      top: pos.y,
      right: pos.x + DEFAULT_TOOLBAR_W,
      bottom: pos.y + DEFAULT_TOOLBAR_H,
    };
  }
  const left = viewport.width - DEFAULT_TOOLBAR_INSET - DEFAULT_TOOLBAR_W;
  const top = DEFAULT_TOOLBAR_INSET;
  return {
    left,
    top,
    right: left + DEFAULT_TOOLBAR_W,
    bottom: top + DEFAULT_TOOLBAR_H,
  };
}

export const DesignPanelV2 = observer(({ uiStore, selectionStore, styleEdit }: Props) => {
  const isDesign = uiStore.mode === 'design';
  const isRuler = uiStore.mode === 'ruler';
  const visible =
    uiStore.visible && (isDesign || isRuler) && selectionStore.selected != null;
  const [sub, setSub] = React.useState<SubTab>('design');
  // Viewport snapshot — bumped on resize/scroll so we re-pick the
  // position. We deliberately do NOT track the panel's rendered height
  // (no ResizeObserver loop) and instead use the conservative max for
  // the avoid check; the actual rendered panel may be shorter (fine —
  // its bbox is a subset of the avoid box).
  const [vp, setVp] = React.useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  // Window listeners: resize + scroll. Gate on `visible` so the panel
  // doesn't keep capture-phase scroll listeners alive when it's hidden
  // (would otherwise touch every scroll in the host page even when the
  // panel can't render).
  React.useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const onChange = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setVp({ width: window.innerWidth, height: window.innerHeight });
        selectionStore.refresh();
      });
    };
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [selectionStore, visible]);

  if (!visible) return null;
  const target = selectionStore.selected!;

  // In ruler mode there is no sub-tab strip; the panel is always the
  // Inspect view. In design mode the sub-tab decides the body.
  const showInspect = isRuler || sub === 'inspect';

  // Reactive position computation. Reading the MobX observables here
  // (selectedRect, hoveredRect, toolbarPosition) re-runs this block on
  // any change.
  const selectedRect = selectionStore.selectedRect;
  const hovered = selectionStore.hovered;
  const hoveredRect = selectionStore.hoveredRect;
  const tbarPos = uiStore.toolbarPosition;

  const avoid: Bbox[] = [toolbarBbox(tbarPos, vp)];
  // Hover tooltip footprint — included so when the user IS hovering
  // an adjacent host element, the panel never sits where the tooltip
  // is about to paint.
  if (hovered != null && hovered !== selectionStore.selected && hoveredRect != null) {
    avoid.push(getHoverTooltipRect(hoveredRect, vp));
  }

  const panelSize = {
    width: PANEL_WIDTH,
    height: Math.min(PANEL_MAX_HEIGHT, vp.height - 2 * PANEL_MARGIN),
  };
  const placement = pickPanelPosition({
    targetRect: selectedRect,
    panelSize,
    viewport: vp,
    avoid,
    gap: PANEL_GAP,
    handlePad: PANEL_HANDLE_PAD,
    margin: PANEL_MARGIN,
  });

  // Fixed height anchors the flex column so .dv-scroll's `flex: 1`
  // actually has space to expand into. Capped at PANEL_MAX_HEIGHT and
  // by the remaining viewport room below `placement.top`.
  const height = Math.max(
    120,
    Math.min(PANEL_MAX_HEIGHT, vp.height - placement.top - PANEL_MARGIN),
  );

  return (
    <div
      role="region"
      aria-label="paperx design panel V2"
      data-testid="paperx-v2-panel"
      data-mode={uiStore.mode ?? undefined}
      className="dv-inspector"
      style={{
        position: 'fixed',
        left: `${placement.left}px`,
        top: `${placement.top}px`,
        width: `${PANEL_WIDTH}px`,
        height: `${height}px`,
        zIndex: 2147483646,
        display: 'flex',
        flexDirection: 'column',
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
