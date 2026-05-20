/**
 * Border section — multi-row editor.
 *
 * Behavior delegated to `useBorderEditor` in `@/shared/design-logic/border`
 * so the legacy DesignPanel and the design-v2 inspector share one source
 * of truth for entries, side-mutual-exclusion, color normalization, and
 * commit-on-change semantics. Visual layout and `data-testid` set are
 * unchanged from the pre-refactor v0.5.0 implementation.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as Popover from '@radix-ui/react-popover';
import {
  AlignJustify,
  Check,
  Eye,
  EyeOff,
  Minus,
  Plus,
  SlidersHorizontal,
  Square,
} from 'lucide-react';

import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { ColorPicker } from '@/shared/ui/ColorPicker';
import { cn } from '@/shared/ui/utils';
import { usePortalContainer } from '@/shared/ui/portal';
import {
  type BorderEntry,
  type BorderSide,
  type BorderStyle,
  SIDE_OPTIONS,
  STYLE_OPTIONS,
  useBorderEditor,
} from '@/shared/design-logic/border';
import type { IStyleEditService } from '@/shared/services/StyleEditService';

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

interface RowProps {
  entry: BorderEntry;
  usedSides: Set<BorderSide>;
  onChangeSide: (id: string, next: BorderSide) => void;
  onChangeWidth: (id: string, width: number) => void;
  onChangeColor: (id: string, color: string) => void;
  onPreviewColor: (id: string, color: string) => void;
  onToggleVisible: (id: string) => void;
  onRemove: (id: string) => void;
}

const Row: React.FC<RowProps> = ({
  entry,
  usedSides,
  onChangeSide,
  onChangeWidth,
  onChangeColor,
  onPreviewColor,
  onToggleVisible,
  onRemove,
}) => {
  return (
    <div className="flex flex-col gap-1" data-testid={`paperx-border-row-${entry.id}`}>
      <div className="flex items-center gap-1.5">
        {/* Width */}
        <div className="flex h-6 flex-1 items-center gap-1 rounded-sm border border-input bg-white/5 px-1.5">
          <AlignJustify className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            data-testid={`paperx-border-${entry.id}-width`}
            type="text"
            inputMode="numeric"
            value={entry.width === 0 ? '' : String(entry.width)}
            placeholder="0"
            onChange={(e) => {
              const n = parseInt(e.currentTarget.value, 10);
              onChangeWidth(entry.id, Number.isFinite(n) && n >= 0 ? n : 0);
            }}
            className="h-5 w-full border-0 bg-transparent px-0 text-[11px] focus-visible:ring-0"
          />
        </div>

        {/* Direction */}
        <div className="flex h-6 flex-1 items-center gap-1 rounded-sm border border-input bg-white/5 px-1.5">
          <Square className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <select
            data-testid={`paperx-border-${entry.id}-direction`}
            value={entry.side}
            onChange={(e) => onChangeSide(entry.id, e.currentTarget.value as BorderSide)}
            className="h-5 w-full border-0 bg-transparent text-[11px] outline-none"
          >
            {SIDE_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.value !== entry.side && usedSides.has(opt.value)}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Visibility */}
        <button
          type="button"
          data-testid={`paperx-border-${entry.id}-visible`}
          aria-pressed={entry.visible}
          aria-label={entry.visible ? 'Hide' : 'Show'}
          onClick={() => onToggleVisible(entry.id)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {entry.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>

        {/* Remove */}
        <button
          type="button"
          data-testid={`paperx-border-${entry.id}-remove`}
          aria-label="Remove border"
          onClick={() => onRemove(entry.id)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Color sub-row — single integrated trigger (swatch + hex + alpha%). */}
      <ColorPicker
        value={entry.color}
        onChange={(next) => onChangeColor(entry.id, next)}
        onPreview={(next) => onPreviewColor(entry.id, next)}
        ariaLabel="Border color"
      />
    </div>
  );
};

export const BorderSection = observer(({ target, styleEdit }: Props) => {
  const {
    entries,
    globalStyle,
    usedSides,
    canAdd,
    handleAdd,
    handleChangeSide,
    handleChangeWidth,
    handleChangeColor,
    handlePreviewColor,
    handleToggleVisible,
    handleRemove,
    handleSetStyle,
  } = useBorderEditor({ target, styleEdit });

  const [styleMenuOpen, setStyleMenuOpen] = React.useState(false);
  const portalContainer = usePortalContainer();

  const onPickStyle = (style: BorderStyle) => {
    handleSetStyle(style);
    setStyleMenuOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="normal-case tracking-normal">Border</Label>
        <div className="flex items-center gap-1">
          {/* Style picker (global) */}
          <Popover.Root open={styleMenuOpen} onOpenChange={setStyleMenuOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                data-testid="paperx-border-style-trigger"
                aria-label="Border style"
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <SlidersHorizontal className="h-3 w-3" />
              </button>
            </Popover.Trigger>
            <Popover.Portal container={portalContainer}>
              <Popover.Content
                sideOffset={6}
                align="end"
                className={cn(
                  'paperx-surface pointer-events-auto',
                  'z-[2147483647] w-28 rounded-md p-1 shadow-xl outline-none',
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {STYLE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-testid={`paperx-border-style-${s}`}
                    onClick={() => onPickStyle(s)}
                    className={cn(
                      'flex h-7 w-full items-center justify-start gap-1.5 rounded-sm px-2 text-[11px] capitalize transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      globalStyle === s ? 'text-white' : 'text-muted-foreground',
                    )}
                  >
                    {globalStyle === s ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="inline-block h-3 w-3" />
                    )}
                    <span>{s}</span>
                  </button>
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* Add row */}
          <button
            type="button"
            data-testid="paperx-border-add"
            aria-label="Add border direction"
            onClick={handleAdd}
            disabled={!canAdd}
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="paperx-border-rows">
          {entries.map((entry) => (
            <Row
              key={entry.id}
              entry={entry}
              usedSides={usedSides}
              onChangeSide={handleChangeSide}
              onChangeWidth={handleChangeWidth}
              onChangeColor={handleChangeColor}
              onPreviewColor={handlePreviewColor}
              onToggleVisible={handleToggleVisible}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
});
BorderSection.displayName = 'BorderSection';

export type { BorderEntry, BorderSide, BorderStyle };
