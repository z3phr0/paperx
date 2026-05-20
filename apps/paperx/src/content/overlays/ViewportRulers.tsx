/**
 * ViewportRulers — Photoshop-style top + left rulers along the viewport
 * edges, with a colored band marking the selected element's bounds.
 *
 * Ruler-mode only — keeps the screen clean when the user isn't actively
 * measuring. Major ticks every 100 px with numeric labels, minor ticks
 * every 10 px. Re-renders on scroll / resize via a single rAF-coalesced
 * tick that pumps a state counter.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
}

const RULER_PX = 16;
const Z = 2147483639;

const COLORS = {
  bg: 'rgba(20, 20, 24, 0.92)',
  border: 'rgba(148, 163, 184, 0.4)',
  major: 'rgba(226, 232, 240, 0.85)',
  minor: 'rgba(148, 163, 184, 0.5)',
  band: 'rgba(37, 99, 235, 0.35)',
  bandStroke: '#2563eb',
  label: '#cbd5e1',
};

interface UseTickProps {
  active: boolean;
}

/** Force re-render on scroll / resize while active. Coalesced via rAF. */
function useTick({ active }: UseTickProps): void {
  const [, set] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    let raf = 0;
    let dirty = false;
    const flush = () => {
      raf = 0;
      if (dirty) {
        dirty = false;
        set((n) => n + 1);
      }
    };
    const schedule = () => {
      dirty = true;
      if (raf === 0) raf = requestAnimationFrame(flush);
    };
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [active]);
}

function majorTicksUpTo(end: number): number[] {
  const out: number[] = [];
  for (let p = 0; p <= end; p += 100) out.push(p);
  return out;
}

function minorTicksUpTo(end: number): number[] {
  const out: number[] = [];
  for (let p = 0; p <= end; p += 10) {
    if (p % 100 !== 0) out.push(p);
  }
  return out;
}

export const ViewportRulers = observer(({ uiStore, selectionStore }: Props) => {
  const active = uiStore.visible && uiStore.mode === 'ruler';
  useTick({ active });
  if (!active) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = selectionStore.selectedRect ?? null;

  const majorH = majorTicksUpTo(vw);
  const minorH = minorTicksUpTo(vw);
  const majorV = majorTicksUpTo(vh);
  const minorV = minorTicksUpTo(vh);

  return (
    <div aria-hidden data-testid="paperx-rulers" style={{ pointerEvents: 'none' }}>
      {/* top ruler */}
      <svg
        data-testid="paperx-ruler-top"
        width={vw}
        height={RULER_PX}
        viewBox={`0 0 ${vw} ${RULER_PX}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: vw,
          height: RULER_PX,
          zIndex: Z,
          background: COLORS.bg,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        {minorH.map((x) => (
          <line key={`mh-${x}`} x1={x} y1={RULER_PX - 4} x2={x} y2={RULER_PX} stroke={COLORS.minor} strokeWidth={1} />
        ))}
        {majorH.map((x) => (
          <g key={`Mh-${x}`}>
            <line x1={x} y1={RULER_PX - 8} x2={x} y2={RULER_PX} stroke={COLORS.major} strokeWidth={1} />
            <text x={x + 2} y={9} fontSize={9} fontFamily="ui-monospace, monospace" fill={COLORS.label}>{x}</text>
          </g>
        ))}
        {rect && rect.width > 0 && (
          <rect
            x={Math.max(0, rect.left)}
            y={0}
            width={Math.max(1, Math.min(vw, rect.right) - Math.max(0, rect.left))}
            height={RULER_PX}
            fill={COLORS.band}
            stroke={COLORS.bandStroke}
            strokeWidth={1}
          />
        )}
      </svg>

      {/* left ruler */}
      <svg
        data-testid="paperx-ruler-left"
        width={RULER_PX}
        height={vh}
        viewBox={`0 0 ${RULER_PX} ${vh}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: RULER_PX,
          height: vh,
          zIndex: Z,
          background: COLORS.bg,
          borderRight: `1px solid ${COLORS.border}`,
        }}
      >
        {minorV.map((y) => (
          <line key={`mv-${y}`} x1={RULER_PX - 4} y1={y} x2={RULER_PX} y2={y} stroke={COLORS.minor} strokeWidth={1} />
        ))}
        {majorV.map((y) => (
          <g key={`Mv-${y}`}>
            <line x1={RULER_PX - 8} y1={y} x2={RULER_PX} y2={y} stroke={COLORS.major} strokeWidth={1} />
            {/* Labels go vertical via transform around the tick anchor. */}
            <text
              x={0}
              y={0}
              fontSize={9}
              fontFamily="ui-monospace, monospace"
              fill={COLORS.label}
              transform={`translate(8, ${y + 2}) rotate(-90)`}
              textAnchor="end"
            >
              {y}
            </text>
          </g>
        ))}
        {rect && rect.height > 0 && (
          <rect
            x={0}
            y={Math.max(0, rect.top)}
            width={RULER_PX}
            height={Math.max(1, Math.min(vh, rect.bottom) - Math.max(0, rect.top))}
            fill={COLORS.band}
            stroke={COLORS.bandStroke}
            strokeWidth={1}
          />
        )}
      </svg>
    </div>
  );
});
ViewportRulers.displayName = 'ViewportRulers';
