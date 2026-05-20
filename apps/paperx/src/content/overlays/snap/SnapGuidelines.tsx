/**
 * SnapGuidelines — full-viewport magenta lines that flash at active
 * snap coordinates. Subscribes to SnapStore; renders nothing when both
 * guideX and guideY are null (i.e. not dragging or no snap).
 *
 * Z-index 2147483640 sits with PickerOverlay and below the resize
 * handles (2147483641) so the user sees the handles on top of any
 * guide. pointer-events: none — guides never swallow the drag.
 */
import { observer } from 'mobx-react-lite';

import type { SnapStore } from '@/shared/stores/SnapStore';

interface Props {
  snapStore: SnapStore;
}

const Z = 2147483640;
const COLOR = '#ec4899';

export const SnapGuidelines = observer(({ snapStore }: Props) => {
  const { guideX, guideY } = snapStore;
  if (guideX == null && guideY == null) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return (
    <svg
      aria-hidden
      data-testid="paperx-snap-guides"
      width={vw}
      height={vh}
      viewBox={`0 0 ${vw} ${vh}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: vw,
        height: vh,
        zIndex: Z,
        pointerEvents: 'none',
      }}
    >
      {guideX != null && (
        <line
          data-testid="paperx-snap-guide-x"
          x1={guideX}
          y1={0}
          x2={guideX}
          y2={vh}
          stroke={COLOR}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      {guideY != null && (
        <line
          data-testid="paperx-snap-guide-y"
          x1={0}
          y1={guideY}
          x2={vw}
          y2={guideY}
          stroke={COLOR}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
});
SnapGuidelines.displayName = 'SnapGuidelines';
