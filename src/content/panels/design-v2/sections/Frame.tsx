/**
 * Frame section — Size + Position + Padding + Margin.
 *
 * Layout matches paperx-inspector.jsx#DesignSub: 3-col Size/Position/
 * Rotation row, then 3-col W/H/flip-trio row, then label-on-left rows
 * for Position (L/R/T/B in a 2x2 grid), Padding (compact X/Y ↔ expanded
 * L/R/T/B), Margin (same shape as Padding).
 *
 * All writes go through `IStyleEditService.apply` (single writer rule).
 * Each commit is one ChangeLog record — same grain as V1 BoxModel.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { formatLengthPx } from '@/shared/types/numeric';
import { Icon, IconButton, Input, Section } from '@/shared/ui-v2';
import { readPx } from '../hooks/useComputedStyle';

interface Props {
  target: HTMLElement;
  styleEdit: IStyleEditService;
}

/**
 * Format + commit a px value for a single CSS prop. Empty / invalid
 * input is a no-op so the user can edit-then-erase without writing an
 * orphan ChangeLog row.
 */
function commit(
  styleEdit: IStyleEditService,
  target: HTMLElement,
  prop: string,
  raw: string,
): void {
  if (raw.trim() === '') return;
  const formatted = formatLengthPx(raw, { allowNegative: true });
  if (formatted == null) return;
  styleEdit.apply(target, prop, formatted);
}

interface FieldProps {
  prop: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  target: HTMLElement;
  styleEdit: IStyleEditService;
  testid?: string;
}

const Field: React.FC<FieldProps> = ({
  prop,
  prefix,
  suffix,
  target,
  styleEdit,
  testid,
}) => {
  const seed = React.useMemo(() => readPx(target, prop), [target, prop]);
  const [value, setValue] = React.useState(seed);
  React.useEffect(() => setValue(seed), [seed]);
  return (
    <Input
      value={value}
      prefix={prefix}
      suffix={suffix}
      placeholder="—"
      data-testid={testid}
      onChange={(next) => {
        setValue(next);
        commit(styleEdit, target, prop, next);
      }}
    />
  );
};

/**
 * Quad of L/R/T/B inputs in a 2-column grid. Each input commits its
 * own kebab-prop independently.
 */
interface QuadProps {
  propL: string;
  propR: string;
  propT: string;
  propB: string;
  target: HTMLElement;
  styleEdit: IStyleEditService;
  testidPrefix?: string;
}

const Quad: React.FC<QuadProps> = ({
  propL,
  propR,
  propT,
  propB,
  target,
  styleEdit,
  testidPrefix,
}) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, flex: 1 }}>
    <Field
      prop={propL}
      prefix="L"
      target={target}
      styleEdit={styleEdit}
      testid={testidPrefix ? `${testidPrefix}-l` : undefined}
    />
    <Field
      prop={propR}
      prefix="R"
      target={target}
      styleEdit={styleEdit}
      testid={testidPrefix ? `${testidPrefix}-r` : undefined}
    />
    <Field
      prop={propT}
      prefix="T"
      target={target}
      styleEdit={styleEdit}
      testid={testidPrefix ? `${testidPrefix}-t` : undefined}
    />
    <Field
      prop={propB}
      prefix="B"
      target={target}
      styleEdit={styleEdit}
      testid={testidPrefix ? `${testidPrefix}-b` : undefined}
    />
  </div>
);

/**
 * `transform: rotate(...)` is a composite value. The V2 panel writes
 * the bare `rotate(${n}deg)`; if the host already has e.g. `scale(2)`
 * the user-visible side-effect is that scale is dropped. That's the
 * documented one-period tradeoff in the plan; a transform-parser is
 * tracked for the next sprint.
 */
function commitRotation(
  styleEdit: IStyleEditService,
  target: HTMLElement,
  raw: string,
): void {
  const trimmed = raw.trim();
  if (trimmed === '') return;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return;
  styleEdit.apply(target, 'transform', `rotate(${Math.round(n)}deg)`);
}

function readRotation(target: HTMLElement): string {
  const inline = target.style.transform || '';
  const m = /rotate\((-?[\d.]+)deg\)/i.exec(inline);
  if (m && m[1] != null) return String(Math.round(parseFloat(m[1])));
  return '';
}

const RotationField: React.FC<{
  target: HTMLElement;
  styleEdit: IStyleEditService;
}> = ({ target, styleEdit }) => {
  const seed = React.useMemo(() => readRotation(target), [target]);
  const [value, setValue] = React.useState(seed);
  React.useEffect(() => setValue(seed), [seed]);
  return (
    <Input
      value={value}
      prefix={<Icon name="rotate" size={11} />}
      suffix="°"
      placeholder="0"
      data-testid="paperx-v2-frame-rotation"
      onChange={(next) => {
        setValue(next);
        commitRotation(styleEdit, target, next);
      }}
    />
  );
};

export const FrameSection = observer(({ target, styleEdit }: Props) => {
  const [padExpanded, setPadExpanded] = React.useState(false);
  const [marginExpanded, setMarginExpanded] = React.useState(false);

  // Reset expansion state when target changes so the panel re-opens at
  // the compact default — matches paperx-inspector.jsx behavior.
  React.useEffect(() => {
    setPadExpanded(false);
    setMarginExpanded(false);
  }, [target]);

  return (
    <Section
      title="Frame"
      actions={<IconButton icon="link" title="Lock proportions" />}
      data-testid="paperx-v2-frame"
    >
      {/* Row 1 — X / Y / Rotation */}
      <div
        className="dv-row"
        style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}
      >
        <Field
          prop="left"
          prefix="X"
          target={target}
          styleEdit={styleEdit}
          testid="paperx-v2-frame-x"
        />
        <Field
          prop="top"
          prefix="Y"
          target={target}
          styleEdit={styleEdit}
          testid="paperx-v2-frame-y"
        />
        <RotationField target={target} styleEdit={styleEdit} />
      </div>

      {/* Row 2 — W / H + flip trio */}
      <div
        className="dv-row"
        style={{
          gridTemplateColumns: '1fr 1fr auto',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <Field
          prop="width"
          prefix="W"
          target={target}
          styleEdit={styleEdit}
          testid="paperx-v2-frame-w"
        />
        <Field
          prop="height"
          prefix="H"
          target={target}
          styleEdit={styleEdit}
          testid="paperx-v2-frame-h"
        />
        <div style={{ display: 'flex', gap: 2 }}>
          <IconButton icon="rotate-icon" title="Rotate 90°" />
          <IconButton icon="flip-h" title="Flip horizontal" />
          <IconButton icon="flip-v" title="Flip vertical" />
        </div>
      </div>

      {/* Position L/R/T/B */}
      <div
        className="dv-row"
        style={{
          gridTemplateColumns: '64px 1fr',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <div className="dv-row-label">Position</div>
        <Quad
          propL="left"
          propR="right"
          propT="top"
          propB="bottom"
          target={target}
          styleEdit={styleEdit}
          testidPrefix="paperx-v2-frame-position"
        />
      </div>

      {/* Padding row */}
      <div
        className="dv-row"
        style={{
          gridTemplateColumns: '64px 1fr',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <div className="dv-row-label">Padding</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: 4,
            flex: 1,
            alignItems: 'center',
          }}
        >
          {padExpanded ? (
            <>
              <Field
                prop="padding-left"
                prefix="L"
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-padding-l"
              />
              <Field
                prop="padding-right"
                prefix="R"
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-padding-r"
              />
              <span />
              <Field
                prop="padding-top"
                prefix="T"
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-padding-t"
              />
              <Field
                prop="padding-bottom"
                prefix="B"
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-padding-b"
              />
              <IconButton
                icon="pad-all"
                title="Combine padding"
                onClick={() => setPadExpanded(false)}
                data-testid="paperx-v2-frame-padding-combine"
              />
            </>
          ) : (
            <>
              <PadAxisField
                prop1="padding-left"
                prop2="padding-right"
                prefix={<Icon name="pad-h" size={11} />}
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-padding-x"
              />
              <PadAxisField
                prop1="padding-top"
                prop2="padding-bottom"
                prefix={<Icon name="pad-v" size={11} />}
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-padding-y"
              />
              <IconButton
                icon="corners-individual"
                title="Individual padding"
                onClick={() => setPadExpanded(true)}
                data-testid="paperx-v2-frame-padding-expand"
              />
            </>
          )}
        </div>
      </div>

      {/* Margin row */}
      <div
        className="dv-row"
        style={{
          gridTemplateColumns: '64px 1fr',
          gap: 6,
          alignItems: 'center',
          marginBottom: 0,
        }}
      >
        <div className="dv-row-label">Margin</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: 4,
            flex: 1,
            alignItems: 'center',
          }}
        >
          {marginExpanded ? (
            <>
              <Field
                prop="margin-left"
                prefix="L"
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-margin-l"
              />
              <Field
                prop="margin-right"
                prefix="R"
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-margin-r"
              />
              <span />
              <Field
                prop="margin-top"
                prefix="T"
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-margin-t"
              />
              <Field
                prop="margin-bottom"
                prefix="B"
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-margin-b"
              />
              <IconButton
                icon="pad-all"
                title="Combine margin"
                onClick={() => setMarginExpanded(false)}
                data-testid="paperx-v2-frame-margin-combine"
              />
            </>
          ) : (
            <>
              <PadAxisField
                prop1="margin-left"
                prop2="margin-right"
                prefix={<Icon name="pad-h" size={11} />}
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-margin-x"
              />
              <PadAxisField
                prop1="margin-top"
                prop2="margin-bottom"
                prefix={<Icon name="pad-v" size={11} />}
                target={target}
                styleEdit={styleEdit}
                testid="paperx-v2-frame-margin-y"
              />
              <IconButton
                icon="corners-individual"
                title="Individual margin"
                onClick={() => setMarginExpanded(true)}
                data-testid="paperx-v2-frame-margin-expand"
              />
            </>
          )}
        </div>
      </div>
    </Section>
  );
});
FrameSection.displayName = 'FrameSection';

/**
 * Single-axis padding/margin input that writes the same value to both
 * sides on that axis (left+right for X, top+bottom for Y).
 *
 * Seed is read from `prop1` only; equal value displayed when both sides
 * agree, else falls back to `prop1`. Commit broadcasts to both props so
 * the user gets two ChangeLog rows per edit — matches BoxModel link UX.
 */
interface PadAxisFieldProps {
  prop1: string;
  prop2: string;
  prefix: React.ReactNode;
  target: HTMLElement;
  styleEdit: IStyleEditService;
  testid?: string;
}

const PadAxisField: React.FC<PadAxisFieldProps> = ({
  prop1,
  prop2,
  prefix,
  target,
  styleEdit,
  testid,
}) => {
  const seed = React.useMemo(() => {
    const a = readPx(target, prop1);
    const b = readPx(target, prop2);
    return a === b ? a : a;
  }, [target, prop1, prop2]);
  const [value, setValue] = React.useState(seed);
  React.useEffect(() => setValue(seed), [seed]);
  return (
    <Input
      value={value}
      prefix={prefix}
      placeholder="0"
      data-testid={testid}
      onChange={(next) => {
        setValue(next);
        commit(styleEdit, target, prop1, next);
        commit(styleEdit, target, prop2, next);
      }}
    />
  );
};
