/**
 * DesignPanelV2 — the Claude-Design-handoff Inspector reborn.
 *
 * Visibility contract matches the legacy DesignPanel: rendered only when
 * `uiStore.mode === 'design'` AND `SelectionStore.selected != null`.
 * Pixel dimensions / visual identity follow figma-builder/project/
 * paperx-inspector.jsx — 280px width, macOS-glass surface (via .dv-
 * inspector), top-of-card [Design | Inspect] sub-tab strip.
 *
 * Each sub-tab renders a different content set:
 *   - design:  Frame / Appearance / Fill / Border (Sprint 5) / Radius (Sprint 5)
 *   - inspect: BoxModel + CSS/Tailwind/Code (Sprint 5)
 *
 * The shell ships in Sprint 4 with Border / Radius / Inspect rendered as
 * "TODO" markers; Sprint 5 swaps them for real implementations.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

import { FrameSection } from './sections/Frame';
import { AppearanceSection } from './sections/Appearance';
import { FillSection } from './sections/Fill';

type SubTab = 'design' | 'inspect';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  styleEdit: IStyleEditService;
}

const TodoSection: React.FC<{ title: string }> = ({ title }) => (
  <div className="dv-section">
    <div className="dv-section-header">
      <div className="dv-section-title">{title}</div>
    </div>
    <div
      style={{
        padding: '12px 0',
        fontSize: 11,
        color: 'var(--dv-text-muted)',
        textAlign: 'center',
      }}
    >
      Coming soon · sprint 5
    </div>
  </div>
);

export const DesignPanelV2 = observer(({ uiStore, selectionStore, styleEdit }: Props) => {
  const visible =
    uiStore.visible && uiStore.mode === 'design' && selectionStore.selected != null;
  const [sub, setSub] = React.useState<SubTab>('design');

  if (!visible) return null;
  const target = selectionStore.selected!;

  return (
    <div
      role="region"
      aria-label="paperx design panel V2"
      data-testid="paperx-v2-panel"
      className="dv-inspector"
      style={{
        position: 'fixed',
        right: '16px',
        top: '56px',
        bottom: '16px',
        zIndex: 2147483646,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 72px)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
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
      <div
        className="dv-scroll"
        style={{ flex: 1, minHeight: 0 }}
        data-testid={`paperx-v2-content-${sub}`}
      >
        {sub === 'design' && (
          <>
            <FrameSection target={target} styleEdit={styleEdit} />
            <AppearanceSection target={target} styleEdit={styleEdit} />
            <FillSection target={target} styleEdit={styleEdit} />
            <TodoSection title="Border" />
            <TodoSection title="Radius" />
          </>
        )}
        {sub === 'inspect' && <TodoSection title="Box model + code" />}
      </div>
    </div>
  );
});
DesignPanelV2.displayName = 'DesignPanelV2';
