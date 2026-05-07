/**
 * Effects section — 4-corner border-radius editor with a link toggle.
 *
 * Inputs are arranged in a 2×2 grid (TL/TR row, BL/BR row). When the
 * link toggle is active, editing any cell broadcasts the value to all
 * four `border-{tl,tr,br,bl}-radius` props — same pattern as
 * BoxModel padding/margin link.
 *
 * 4 separate `styleEdit.apply` calls are dispatched on broadcast so
 * ChangeLog records 4 rows (matches the BoxModel link UX).
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { pxToInt, formatLengthPx } from '@/shared/types/numeric';

type Corner = 'tl' | 'tr' | 'br' | 'bl';

const CORNERS: ReadonlyArray<Corner> = ['tl', 'tr', 'br', 'bl'];

const CORNER_TO_PROP: Record<Corner, string> = {
  tl: 'border-top-left-radius',
  tr: 'border-top-right-radius',
  br: 'border-bottom-right-radius',
  bl: 'border-bottom-left-radius',
};

function read(target: HTMLElement, prop: string): string {
  // Read seed values via getComputedStyle only — StyleEditService owns
  // inline mutations, so we never reach into the inline declaration here.
  try {
    return (getComputedStyle(target).getPropertyValue(prop) ?? '').trim();
  } catch {
    return '';
  }
}

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const EffectsSection = observer(({ target, styleEdit }: Props) => {
  const seed = React.useMemo(() => {
    const out: Record<Corner, string> = { tl: '', tr: '', br: '', bl: '' };
    for (const c of CORNERS) {
      out[c] = pxToInt(read(target, CORNER_TO_PROP[c]));
    }
    return out;
  }, [target]);

  const [radius, setRadius] = React.useState<Record<Corner, string>>(seed);
  const [linked, setLinked] = React.useState<boolean>(true);

  React.useEffect(() => setRadius(seed), [seed]);

  const commitCorner = (corner: Corner, raw: string) => {
    if (linked) {
      setRadius({ tl: raw, tr: raw, br: raw, bl: raw });
    } else {
      setRadius((prev) => ({ ...prev, [corner]: raw }));
    }
    if (raw.trim() === '') return;
    const formatted = formatLengthPx(raw, { allowNegative: false });
    if (formatted == null) return;
    if (linked) {
      // Broadcast: 4 separate apply() calls so ChangeLog gets 4 rows.
      for (const c of CORNERS) {
        styleEdit.apply(target, CORNER_TO_PROP[c], formatted);
      }
    } else {
      styleEdit.apply(target, CORNER_TO_PROP[corner], formatted);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="normal-case tracking-normal">Border radius</Label>
        <button
          type="button"
          data-testid="paperx-radius-link"
          onClick={() => setLinked((v) => !v)}
          aria-pressed={linked}
          title={linked ? 'Unlink corners' : 'Link corners'}
          className={
            'inline-flex h-6 items-center rounded-sm border px-2 text-[10px] font-medium transition-colors ' +
            (linked
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground')
          }
        >
          {linked ? 'linked' : 'free'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex items-center gap-1">
          <span className="w-7 text-[10px] uppercase text-muted-foreground">TL</span>
          <Input
            data-testid="paperx-radius-tl"
            type="text"
            inputMode="numeric"
            value={radius.tl}
            placeholder="0"
            onChange={(e) => commitCorner('tl', e.currentTarget.value)}
            className="h-6 flex-1 px-1 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="w-7 text-[10px] uppercase text-muted-foreground">TR</span>
          <Input
            data-testid="paperx-radius-tr"
            type="text"
            inputMode="numeric"
            value={radius.tr}
            placeholder="0"
            onChange={(e) => commitCorner('tr', e.currentTarget.value)}
            className="h-6 flex-1 px-1 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="w-7 text-[10px] uppercase text-muted-foreground">BL</span>
          <Input
            data-testid="paperx-radius-bl"
            type="text"
            inputMode="numeric"
            value={radius.bl}
            placeholder="0"
            onChange={(e) => commitCorner('bl', e.currentTarget.value)}
            className="h-6 flex-1 px-1 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="w-7 text-[10px] uppercase text-muted-foreground">BR</span>
          <Input
            data-testid="paperx-radius-br"
            type="text"
            inputMode="numeric"
            value={radius.br}
            placeholder="0"
            onChange={(e) => commitCorner('br', e.currentTarget.value)}
            className="h-6 flex-1 px-1 text-[10px]"
          />
        </div>
      </div>
    </div>
  );
});
EffectsSection.displayName = 'EffectsSection';
