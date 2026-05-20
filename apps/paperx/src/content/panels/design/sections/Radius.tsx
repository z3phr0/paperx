/**
 * Radius section — border-radius editor.
 *
 * Behavior delegated to `useRadiusEditor` in `@/shared/design-logic/radius`
 * so the legacy DesignPanel and the design-v2 inspector share one state
 * machine. Visual layout and `data-testid` set are unchanged from the
 * pre-refactor implementation.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Maximize2, Minimize2, Plus } from 'lucide-react';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { Slider } from '@/shared/ui/Slider';
import {
  type Corner,
  CORNERS,
  DEFAULT_RADIUS_PX,
  SLIDER_MAX,
  useRadiusEditor,
} from '@/shared/design-logic/radius';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

/**
 * Tiny inline SVG glyph indicating which corner of a square is
 * affected. Used as the prefix icon next to each per-corner input.
 */
function CornerGlyph({ corner }: { corner: Corner }): React.ReactElement {
  const rotation: Record<Corner, number> = { tl: 0, tr: 90, br: 180, bl: 270 };
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ transform: `rotate(${rotation[corner]}deg)` }}
      aria-hidden
    >
      <path d="M 2 12 L 2 6 A 4 4 0 0 1 6 2 L 12 2" />
    </svg>
  );
}

export const RadiusSection = observer(({ target, styleEdit }: Props) => {
  const {
    radius,
    mode,
    setMode,
    enabled,
    unifiedValue,
    unifiedNumber,
    commitUnified,
    commitCorner,
  } = useRadiusEditor({ target, styleEdit });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="normal-case tracking-normal">Radius</Label>
        {enabled ? (
          <button
            type="button"
            data-testid="paperx-radius-mode-toggle"
            onClick={() => setMode((m) => (m === 'unified' ? 'per-corner' : 'unified'))}
            aria-pressed={mode === 'per-corner'}
            title={mode === 'unified' ? 'Switch to per-corner' : 'Switch to unified'}
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {mode === 'unified' ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </button>
        ) : (
          <button
            type="button"
            data-testid="paperx-radius-add"
            onClick={() => commitUnified(DEFAULT_RADIUS_PX)}
            aria-label="Enable radius"
            title="Enable radius (8px)"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {!enabled ? null : mode === 'unified' ? (
        <div className="flex items-center gap-2" data-testid="paperx-radius-unified">
          <div className="flex-1">
            <Slider
              value={unifiedNumber}
              min={0}
              max={SLIDER_MAX}
              step={1}
              ariaLabel="Border radius"
              onPreview={(v) => commitUnified(String(v))}
              onChange={(v) => commitUnified(String(v))}
              data-testid="paperx-radius-unified-slider"
            />
          </div>
          <Input
            data-testid="paperx-radius-unified-input"
            type="text"
            inputMode="numeric"
            value={unifiedValue}
            placeholder="0"
            onChange={(e) => commitUnified(e.currentTarget.value)}
            className="h-6 w-14 px-1 text-center text-[11px]"
          />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5" data-testid="paperx-radius-per-corner">
          {CORNERS.map((c) => (
            <div
              key={c}
              className="flex items-center gap-1 rounded-sm border border-input bg-white/5 px-1.5"
            >
              <span className="text-muted-foreground">
                <CornerGlyph corner={c} />
              </span>
              <Input
                data-testid={`paperx-radius-${c}`}
                type="text"
                inputMode="numeric"
                value={radius[c]}
                placeholder="0"
                onChange={(e) => commitCorner(c, e.currentTarget.value)}
                className="h-6 w-full border-0 bg-transparent px-0 text-[11px] focus-visible:ring-0"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
RadiusSection.displayName = 'RadiusSection';
