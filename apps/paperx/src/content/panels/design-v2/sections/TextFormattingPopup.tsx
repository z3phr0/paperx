/**
 * TextFormattingPopup — advanced text controls behind the sliders icon
 * in the Text section header. Aligns its top edge with the Text section's
 * top in viewport coords (`modal.top === Text Section header.top`) per
 * the user spec.
 *
 * Renders via portal into `#paperx-portal-layer` so the design-v2.css
 * tokens resolve and host-page CSS cannot bleed in (CLAUDE.md Shadow-DOM
 * injection contract).
 *
 * Source: figma-builder/project/text-panel.jsx#FormattingPopup with two
 * documented deviations:
 *   1. Wrap dropdown uses the project's <Dropdown> (per user request),
 *      losing the design-source's per-option subtitles.
 *   2. Vertical alignment in the preview is purely cosmetic — it doesn't
 *      write `align-self` (the main Text section owns that property).
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { createPortal } from 'react-dom';

import type { IStyleEditService } from '@/shared/services/StyleEditService';
import { Dropdown, Segmented, Input } from '@/shared/ui-v2';
import { usePortalContainer } from '@/shared/ui/portal';

import { IconAlignH } from './Text';

/* ─────────────────────────────────────────────────────────────────────
 * Local icons (mirror Text.tsx style)
 * ──────────────────────────────────────────────────────────────────── */
const Glyph: React.FC<{ size?: number; children: React.ReactNode }> = ({
  size = 14,
  children,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const IconAlignJustify: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <Glyph size={size}>
    <line x1="4" y1="6" x2="20" y2="6" strokeWidth={1.6} />
    <line x1="4" y1="12" x2="20" y2="12" strokeWidth={1.6} />
    <line x1="4" y1="18" x2="20" y2="18" strokeWidth={1.6} />
  </Glyph>
);

const IconCaseSlash: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <Glyph size={size}>
    <line x1="17" y1="5" x2="7" y2="19" strokeWidth={1.6} />
  </Glyph>
);

const CaseLabel: React.FC<{ text: string }> = ({ text }) => (
  <span
    style={{
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: '0.01em',
      fontFamily: 'inherit',
    }}
  >
    {text}
  </span>
);

const IconX: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <Glyph size={size}>
    <path d="M6 6 L18 18" />
    <path d="M18 6 L6 18" />
  </Glyph>
);

/* ─────────────────────────────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────────────────────────────── */
export const POPUP_WIDTH = 280;

type Alignment4 = 'left' | 'center' | 'right' | 'justify';
type Case4 = '' | 'italic' | 'upper' | 'lower' | 'title';
type Wrap3 = 'normal' | 'pretty' | 'balance';

const WRAP_OPTIONS: ReadonlyArray<{ value: Wrap3; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'pretty', label: 'Pretty' },
  { value: 'balance', label: 'Balance' },
];

const CASE_TO_TRANSFORM: Record<Exclude<Case4, '' | 'italic'>, string> = {
  upper: 'uppercase',
  lower: 'lowercase',
  title: 'capitalize',
};

/* ─────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────── */
function readInlineOrComputed(target: HTMLElement, prop: string): string {
  const inline = target.style.getPropertyValue(prop);
  if (inline) return inline.trim();
  try {
    return (getComputedStyle(target).getPropertyValue(prop) ?? '').trim();
  } catch {
    return '';
  }
}

function readAlignment(target: HTMLElement): Alignment4 {
  const raw = readInlineOrComputed(target, 'text-align');
  if (raw === 'center' || raw === 'right' || raw === 'justify') return raw;
  return 'left';
}

function readCase(target: HTMLElement): Case4 {
  const style = readInlineOrComputed(target, 'font-style');
  if (style === 'italic') return 'italic';
  const t = readInlineOrComputed(target, 'text-transform');
  if (t === 'uppercase') return 'upper';
  if (t === 'lowercase') return 'lower';
  if (t === 'capitalize') return 'title';
  return '';
}

function readWrap(target: HTMLElement): Wrap3 {
  const raw = readInlineOrComputed(target, 'text-wrap');
  if (raw === 'pretty' || raw === 'balance') return raw;
  return 'normal';
}

function readTruncation(target: HTMLElement): boolean {
  const clamp = target.style.getPropertyValue('-webkit-line-clamp');
  if (!clamp) return false;
  const n = parseInt(clamp, 10);
  return Number.isFinite(n) && n >= 1;
}

function readMaxLines(target: HTMLElement): number {
  const clamp = target.style.getPropertyValue('-webkit-line-clamp');
  const n = parseInt(clamp, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/* ─────────────────────────────────────────────────────────────────────
 * FmtRow — 64px label | content grid. Label column tuned for short
 * single-word labels (Alignment / Case / Wrap / Truncation / Max lines)
 * so the control side has room inside the 280-wide popup. Label font
 * size + color mirror `.dv-row-label` so the popup reads as the same
 * primitive as the main panel's row.
 * ──────────────────────────────────────────────────────────────────── */
const FmtRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '64px 1fr',
      alignItems: 'center',
      gap: 8,
      minHeight: 'var(--dv-row-h)',
    }}
  >
    <div
      style={{
        fontSize: 'var(--dv-label-size)',
        color: 'var(--dv-label)',
        fontWeight: 500,
        letterSpacing: '-0.005em',
      }}
    >
      {label}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {children}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────── */
export interface TextFormattingPopupProps {
  target: HTMLElement;
  styleEdit: IStyleEditService;
  onClose: () => void;
  /** Viewport coords. Top edge of the popup. */
  top: number;
  /** Viewport coords. Left edge of the popup. */
  left: number;
}

export const TextFormattingPopup = observer(
  ({ target, styleEdit, onClose, top, left }: TextFormattingPopupProps) => {
    const portalContainer = usePortalContainer();
    const rootRef = React.useRef<HTMLDivElement>(null);

    // ── state ──
    const [alignment, setAlignment] = React.useState<Alignment4>(() =>
      readAlignment(target),
    );
    const [textCase, setTextCase] = React.useState<Case4>(() => readCase(target));
    const [wrap, setWrap] = React.useState<Wrap3>(() => readWrap(target));
    const [trunc, setTrunc] = React.useState<boolean>(() => readTruncation(target));
    const [maxLines, setMaxLines] = React.useState<number>(() => readMaxLines(target));

    // Re-seed when target swaps.
    React.useEffect(() => {
      setAlignment(readAlignment(target));
      setTextCase(readCase(target));
      setWrap(readWrap(target));
      setTrunc(readTruncation(target));
      setMaxLines(readMaxLines(target));
    }, [target]);

    // ── Escape-to-dismiss ──
    // Click-outside dismissal was REMOVED in v0.12.2. The previous
    // capture-phase mousedown handler intercepted clicks on the Wrap
    // dropdown's menu items (they portal into #paperx-portal-layer as
    // a SIBLING of this popup, not a descendant — so composedPath
    // never includes rootRef and the handler misread them as outside
    // clicks, unmounting the popup before Radix's onClick could fire).
    // The popup is now persistent; explicit close paths are: the X
    // button, the Escape key, the Text section's sliders toggle, and
    // the auto-close on selection / mode / sub-tab change owned by
    // DesignPanelV2.
    React.useEffect(() => {
      const onKey = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', onKey, true);
      return () => document.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    // ── commit writers ──
    const commitAlignment = (v: Alignment4): void => {
      setAlignment(v);
      styleEdit.apply(target, 'text-align', v);
    };

    const commitCase = (v: Case4): void => {
      if (v === '') return; // Segmented never emits '' on its own
      // Toggle-off: clicking the currently active item clears the
      // case — the user wanted an escape hatch back to "no special
      // case" without a separate "None" segment.
      if (textCase === v) {
        setTextCase('');
        if (v === 'italic') {
          styleEdit.apply(target, 'font-style', 'normal');
        } else {
          styleEdit.apply(target, 'text-transform', 'none');
        }
        return;
      }
      setTextCase(v);
      if (v === 'italic') {
        styleEdit.apply(target, 'font-style', 'italic');
        // Don't clobber text-transform — italic is orthogonal.
      } else {
        styleEdit.apply(target, 'font-style', 'normal');
        styleEdit.apply(target, 'text-transform', CASE_TO_TRANSFORM[v]);
      }
    };

    const commitWrap = (v: Wrap3): void => {
      setWrap(v);
      styleEdit.apply(target, 'text-wrap', v);
    };

    const commitTrunc = (v: 'on' | 'off'): void => {
      const next = v === 'on';
      setTrunc(next);
      if (next) {
        const n = Math.max(1, maxLines || 1);
        styleEdit.apply(target, 'display', '-webkit-box');
        styleEdit.apply(target, '-webkit-box-orient', 'vertical');
        styleEdit.apply(target, 'overflow', 'hidden');
        styleEdit.apply(target, '-webkit-line-clamp', String(n));
      } else {
        // Cleanest reset that preserves layout: clear the clamp count
        // (browser falls back to no clamping) while leaving display/
        // overflow alone — the user can hit the ChangeLog drawer to undo
        // the full sequence if they need a fuller reset.
        styleEdit.apply(target, '-webkit-line-clamp', '');
      }
    };

    const commitMaxLines = (raw: string): void => {
      const n = Math.max(1, parseInt(raw, 10) || 1);
      setMaxLines(n);
      if (trunc) styleEdit.apply(target, '-webkit-line-clamp', String(n));
    };

    // ── preview style ──
    const fontSize = parseFloat(readInlineOrComputed(target, 'font-size')) || 18;
    const lineHeightRaw = readInlineOrComputed(target, 'line-height');
    const lineHeight =
      lineHeightRaw === 'normal' || lineHeightRaw === ''
        ? fontSize * 1.4
        : parseFloat(lineHeightRaw) || fontSize * 1.4;
    const letterSpacing = readInlineOrComputed(target, 'letter-spacing') || 'normal';
    const previewStyle: React.CSSProperties = {
      fontSize,
      lineHeight: `${lineHeight}px`,
      letterSpacing,
      textAlign: alignment,
      color: 'var(--dv-text)',
      fontWeight: 400,
      margin: 0,
      width: '100%',
      textWrap: wrap,
      fontStyle: textCase === 'italic' ? 'italic' : 'normal',
      textTransform:
        textCase === 'upper'
          ? 'uppercase'
          : textCase === 'lower'
            ? 'lowercase'
            : textCase === 'title'
              ? 'capitalize'
              : 'none',
      ...(trunc
        ? {
            display: '-webkit-box',
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }
        : {}),
    };

    // Pick preview text — match design's adaptive sampler.
    let demoText = 'Lorem ipsum';
    if (wrap !== 'normal' || alignment === 'justify') {
      demoText = 'The quick brown fox jumps over the lazy dog.';
    }
    if (trunc) {
      demoText =
        'Perfect typography reduces friction and elevates the reading experience.';
    }

    if (portalContainer == null) return null;

    return createPortal(
      <div
        ref={rootRef}
        className="dv-inspector"
        role="dialog"
        aria-label="Text formatting"
        data-testid="paperx-v2-text-fmt-popup"
        style={{
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          width: `${POPUP_WIDTH}px`,
          zIndex: 2147483647,
          pointerEvents: 'auto',
          padding: 0,
          animation: 'pxFmtIn 160ms cubic-bezier(0.2,0,0,1)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header — height matches a row + 4 px so the title sits on the
            same baseline as the inspector's .dv-tabs strip without
            inheriting the active-tab underline. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--dv-divider)',
            height: 32,
          }}
        >
          <div
            style={{
              padding: '0 var(--dv-section-pad-x)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--dv-text)',
              letterSpacing: '-0.005em',
            }}
          >
            Formatting
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            className="dv-icon-btn"
            style={{ margin: '0 6px' }}
            title="Close"
            data-testid="paperx-v2-text-fmt-close"
          >
            <IconX size={12} />
          </button>
        </div>

        {/* Preview */}
        <div
          style={{
            padding:
              'var(--dv-section-pad-y) var(--dv-section-pad-x) 0',
          }}
        >
          <div
            style={{
              minHeight: 100,
              padding: '14px var(--dv-section-pad-x)',
              background: 'var(--dv-bg-input)',
              border: '1px solid var(--dv-border)',
              borderRadius: 'var(--dv-r-section)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <p style={previewStyle}>{demoText}</p>
            {trunc && (
              <div
                style={{
                  marginTop: 10,
                  textAlign: 'center',
                  fontSize: 11,
                  color: 'var(--dv-text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                Truncate
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            padding: 'var(--dv-section-pad-y) var(--dv-section-pad-x)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--dv-gap-y)',
          }}
        >
          <FmtRow label="Alignment">
            <Segmented<Alignment4>
              full
              value={alignment}
              onChange={commitAlignment}
              items={[
                { value: 'left', icon: <IconAlignH dir="left" />, title: 'Align left' },
                {
                  value: 'center',
                  icon: <IconAlignH dir="center" />,
                  title: 'Align center',
                },
                {
                  value: 'right',
                  icon: <IconAlignH dir="right" />,
                  title: 'Align right',
                },
                { value: 'justify', icon: <IconAlignJustify />, title: 'Justify' },
              ]}
              data-testid="paperx-v2-text-fmt-alignment"
            />
          </FmtRow>

          <FmtRow label="Case">
            <Segmented<Exclude<Case4, ''>>
              full
              // When textCase is '' nothing is highlighted — Segmented
              // compares strictly so passing '' just means no active item.
              value={textCase as Exclude<Case4, ''>}
              onChange={commitCase}
              items={[
                { value: 'italic', icon: <IconCaseSlash />, title: 'Italic' },
                { value: 'upper', icon: <CaseLabel text="AA" />, title: 'Uppercase' },
                { value: 'lower', icon: <CaseLabel text="aa" />, title: 'Lowercase' },
                { value: 'title', icon: <CaseLabel text="Aa" />, title: 'Capitalize' },
              ]}
              data-testid="paperx-v2-text-fmt-case"
            />
          </FmtRow>

          <FmtRow label="Wrap">
            <Dropdown<Wrap3>
              value={wrap}
              onChange={commitWrap}
              items={WRAP_OPTIONS}
              data-testid="paperx-v2-text-fmt-wrap"
              itemTestidPrefix="paperx-v2-text-fmt-wrap"
            />
          </FmtRow>

          <FmtRow label="Truncation">
            <div style={{ marginLeft: 'auto' }}>
              <Segmented<'on' | 'off'>
                value={trunc ? 'on' : 'off'}
                onChange={commitTrunc}
                items={[
                  { value: 'off', label: 'Off' },
                  { value: 'on', label: 'On' },
                ]}
                data-testid="paperx-v2-text-fmt-truncation"
              />
            </div>
          </FmtRow>

          {trunc && (
            <FmtRow label="Max lines">
              <div style={{ width: 80, marginLeft: 'auto' }}>
                <Input
                  flex={false}
                  width={80}
                  value={String(maxLines)}
                  data-testid="paperx-v2-text-fmt-max-lines"
                  onChange={commitMaxLines}
                />
              </div>
            </FmtRow>
          )}
        </div>

        <style>{`
          @keyframes pxFmtIn {
            from { opacity: 0; transform: translateX(6px) scale(0.985); }
            to   { opacity: 1; transform: translateX(0) scale(1); }
          }
        `}</style>
      </div>,
      portalContainer,
    );
  },
);
TextFormattingPopup.displayName = 'TextFormattingPopup';
