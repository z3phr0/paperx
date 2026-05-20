/**
 * Border section — V2 visual reskin of the legacy multi-row editor.
 *
 * Behavior comes 1:1 from `useBorderEditor` (shared with V1), so the
 * entry model, side mutual-exclusion rule, and hex8 color normalization
 * are identical to what the existing e2e suite locks in.
 *
 * Per-row layout follows figma-builder/project/paperx-inspector.jsx
 * `BorderSectionPX`: 4-col grid (width / side-dropdown / visibility /
 * remove) on top, color row beneath. The legacy ColorPicker component
 * powers the color sub-row — it's already portal-safe and exposes the
 * Sketch+alpha controls the V2 design system has no analog for.
 */
import { observer } from 'mobx-react-lite';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import {
  type BorderSide,
  SIDE_OPTIONS,
  STYLE_OPTIONS,
  useBorderEditor,
} from '@/shared/design-logic/border';
import { Dropdown, Icon, IconButton, IconDropdown, Input, Section } from '@/shared/ui-v2';
import { ColorPicker } from '@/shared/ui/ColorPicker';

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

export const BorderSectionV2 = observer(({ target, styleEdit }: Props) => {
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

  return (
    <Section
      title="Border"
      data-testid="paperx-border"
      collapsed={entries.length === 0}
      actions={
        <>
          <IconDropdown
            icon="sliders"
            title="Border style"
            value={globalStyle}
            onChange={(s) => handleSetStyle(s)}
            items={STYLE_OPTIONS.map((s) => ({ value: s, label: s }))}
            data-testid="paperx-border-style"
            itemTestidPrefix="paperx-border-style-opt"
          />
          <IconButton
            icon="plus"
            title="Add border"
            onClick={handleAdd}
            disabled={!canAdd}
            data-testid="paperx-border-add"
          />
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map((entry) => {
          const sideOpts = SIDE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          })).filter(
            (opt) => opt.value === entry.side || !usedSides.has(opt.value as BorderSide),
          );
          return (
            <div
              key={entry.id}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              data-testid={`paperx-border-row-${entry.id}`}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto auto',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <Input
                  prefix={<Icon name="align-h-center" size={11} />}
                  value={entry.width === 0 ? '' : String(entry.width)}
                  placeholder="0"
                  data-testid={`paperx-border-${entry.id}-width`}
                  onChange={(next) => {
                    const n = parseInt(next, 10);
                    handleChangeWidth(entry.id, Number.isFinite(n) && n >= 0 ? n : 0);
                  }}
                />
                <Dropdown
                  value={entry.side}
                  onChange={(s) => handleChangeSide(entry.id, s as BorderSide)}
                  items={sideOpts}
                  data-testid={`paperx-border-${entry.id}-direction`}
                  itemTestidPrefix={`paperx-border-${entry.id}-direction-opt`}
                />
                <IconButton
                  icon={entry.visible ? 'eye' : 'eye-off'}
                  onClick={() => handleToggleVisible(entry.id)}
                  data-testid={`paperx-border-${entry.id}-visible`}
                  title={entry.visible ? 'Hide' : 'Show'}
                />
                <IconButton
                  icon="minus"
                  onClick={() => handleRemove(entry.id)}
                  data-testid={`paperx-border-${entry.id}-remove`}
                  title="Remove border"
                />
              </div>
              {/* Color sub-row — universal ColorPicker on the V2 trigger
                  (28 px row, --dv-* tokens, hover/focus parity with
                  .dv-input and Fill SolidRow). */}
              <ColorPicker
                value={entry.color}
                onChange={(next) => handleChangeColor(entry.id, next)}
                onPreview={(next) => handlePreviewColor(entry.id, next)}
                ariaLabel="Border color"
                triggerVariant="v2"
              />
            </div>
          );
        })}
      </div>
    </Section>
  );
});
BorderSectionV2.displayName = 'BorderSectionV2';
