/**
 * HoverTooltip — visBug-style mini info card that follows the
 * currently hovered element. Mode-agnostic: shows whenever paperx is
 * visible and the picker has a hover target. Read-only — purely
 * informational, no interaction (pointer-events: none).
 *
 * Content (compact):
 *   tag.classes  W × H
 *   color  bg  font   font-size
 *   padding  /  margin
 *
 * Positioning: anchored above the hovered rect (8px gap). Flips below
 * when there's no room above. Horizontal clamp to viewport.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
}

const TOOLTIP_W = 280;
const TOOLTIP_GAP = 8;

function shortClassList(el: HTMLElement): string {
  if (!el.classList || el.classList.length === 0) return '';
  return Array.from(el.classList).slice(0, 2).map((c) => `.${c}`).join('');
}

function px(n: string | number): string {
  if (typeof n === 'number') return `${Math.round(n)}px`;
  return n;
}

interface Sample {
  tag: string;
  classes: string;
  width: number;
  height: number;
  color: string;
  bg: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  padding: string;
  margin: string;
}

function sampleOf(el: HTMLElement, rect: DOMRect): Sample {
  const cs = window.getComputedStyle(el);
  return {
    tag: el.tagName.toLowerCase(),
    classes: shortClassList(el),
    width: rect.width,
    height: rect.height,
    color: cs.color,
    bg: cs.backgroundColor,
    fontFamily: cs.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim() ?? '',
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
    margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
  };
}

function isOpaque(c: string): boolean {
  return c !== '' && c !== 'transparent' && !/rgba?\(.*0\s*\)/.test(c);
}

interface SwatchProps { color: string; }
function Swatch({ color }: SwatchProps): React.ReactElement {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: 2,
        background: color,
        border: '1px solid rgba(0,0,0,0.18)',
        verticalAlign: 'middle',
        marginRight: 4,
      }}
    />
  );
}

export const HoverTooltip = observer(({ uiStore, selectionStore }: Props) => {
  const hovered = selectionStore.hovered;
  const rect = selectionStore.hoveredRect;
  if (!uiStore.visible || !hovered || !rect) return null;

  const sample = sampleOf(hovered, rect);

  // Position: above by default; flip below if there is no room. We don't
  // know the rendered tooltip height ahead of time so use a conservative
  // 120px as the "needs room" threshold.
  const TOOLTIP_H_HINT = 120;
  const fitsAbove = rect.top >= TOOLTIP_H_HINT + TOOLTIP_GAP;
  const top = fitsAbove
    ? Math.max(8, rect.top - TOOLTIP_H_HINT - TOOLTIP_GAP)
    : Math.min(window.innerHeight - 8, rect.bottom + TOOLTIP_GAP);
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, window.innerWidth - TOOLTIP_W - 8),
  );

  return (
    <div
      aria-hidden
      data-testid="paperx-hover-tooltip"
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${TOOLTIP_W}px`,
        zIndex: 2147483641,
        pointerEvents: 'none',
        background: 'rgba(20, 20, 24, 0.92)',
        color: '#f8fafc',
        borderRadius: 6,
        padding: '6px 8px',
        font: '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
        boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        backdropFilter: 'saturate(140%) blur(6px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>
          {sample.tag}
          <span style={{ color: '#94a3b8' }}>{sample.classes}</span>
        </span>
        <span style={{ color: '#cbd5e1' }}>
          {px(sample.width)} × {px(sample.height)}
        </span>
      </div>

      <div style={{ marginTop: 4, color: '#cbd5e1' }}>
        <Swatch color={sample.color} />color {sample.color}
        {isOpaque(sample.bg) && (
          <span style={{ marginLeft: 10 }}>
            <Swatch color={sample.bg} />bg {sample.bg}
          </span>
        )}
      </div>

      <div style={{ marginTop: 2, color: '#cbd5e1' }}>
        font <span style={{ color: '#f8fafc' }}>{sample.fontFamily || 'inherit'}</span>{' '}
        / {sample.fontSize} / {sample.fontWeight}
      </div>

      <div style={{ marginTop: 2, color: '#cbd5e1' }}>
        padding <span style={{ color: '#f8fafc' }}>{sample.padding}</span>
      </div>
      <div style={{ color: '#cbd5e1' }}>
        margin <span style={{ color: '#f8fafc' }}>{sample.margin}</span>
      </div>
    </div>
  );
});
HoverTooltip.displayName = 'HoverTooltip';
