/**
 * BoxModelDiagram — Inspect sub-tab visualization.
 *
 * Three-layer nested frame (margin → border → padding → content) with
 * numeric labels on each side. Mirrors paperx-inspector.jsx#BoxModel.
 * Read-only: pulls values from `getComputedStyle(target)`; never writes.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { readPx } from '../hooks/useComputedStyle';

interface Props {
  target: HTMLElement;
}

function getSpacing(target: HTMLElement, prefix: 'margin' | 'padding') {
  return {
    t: readPx(target, `${prefix}-top`) || '0',
    r: readPx(target, `${prefix}-right`) || '0',
    b: readPx(target, `${prefix}-bottom`) || '0',
    l: readPx(target, `${prefix}-left`) || '0',
  };
}

function getSize(target: HTMLElement) {
  const w = readPx(target, 'width');
  const h = readPx(target, 'height');
  return {
    w: w === '' ? Math.round(target.getBoundingClientRect().width).toString() : w,
    h: h === '' ? Math.round(target.getBoundingClientRect().height).toString() : h,
  };
}

function getBorderWidth(target: HTMLElement) {
  const w = readPx(target, 'border-top-width') || readPx(target, 'border-width') || '0';
  return w;
}

function getBoxSizing(target: HTMLElement): string {
  try {
    return getComputedStyle(target).boxSizing || 'content-box';
  } catch {
    return 'content-box';
  }
}

const sideLabel: React.CSSProperties = {
  position: 'absolute',
  fontSize: 10,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
};

export const BoxModelDiagram = observer(({ target }: Props) => {
  const margin = getSpacing(target, 'margin');
  const padding = getSpacing(target, 'padding');
  const size = getSize(target);
  const borderW = getBorderWidth(target);
  const boxSizing = getBoxSizing(target);

  return (
    <div className="dv-layer-diagram" data-testid="paperx-v2-box-model">
      {/* Margin layer */}
      <div
        style={{
          position: 'relative',
          padding: 18,
          border: '1px dashed rgba(225,95,190,0.5)',
          borderRadius: 8,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: -7,
            left: 8,
            padding: '0 5px',
            background: 'var(--dv-bg-input)',
            fontSize: 9,
            color: '#E15FBE',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          margin
        </span>
        <span style={{ ...sideLabel, top: 2, left: '50%', transform: 'translateX(-50%)', color: '#E15FBE' }}>{margin.t}</span>
        <span style={{ ...sideLabel, bottom: 2, left: '50%', transform: 'translateX(-50%)', color: '#E15FBE' }}>{margin.b}</span>
        <span style={{ ...sideLabel, top: '50%', left: 2, transform: 'translateY(-50%)', color: '#E15FBE' }}>{margin.l}</span>
        <span style={{ ...sideLabel, top: '50%', right: 2, transform: 'translateY(-50%)', color: '#E15FBE' }}>{margin.r}</span>

        {/* Border layer */}
        <div
          style={{
            position: 'relative',
            padding: 14,
            border: '1px solid rgba(208,154,6,0.7)',
            borderRadius: 6,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: -7,
              left: 8,
              padding: '0 5px',
              background: 'var(--dv-bg-input)',
              fontSize: 9,
              color: 'rgba(208,154,6,0.85)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            border · {borderW}
          </span>

          {/* Padding layer */}
          <div
            style={{
              position: 'relative',
              padding: 14,
              background: 'var(--dv-accent-soft)',
              borderRadius: 4,
              border: '1px dashed rgba(208,154,6,0.5)',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -7,
                left: 8,
                padding: '0 5px',
                background: 'var(--dv-bg-input)',
                fontSize: 9,
                color: 'var(--dv-accent)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              padding
            </span>
            <span style={{ ...sideLabel, top: 2, left: '50%', transform: 'translateX(-50%)', color: 'var(--dv-accent)' }}>{padding.t}</span>
            <span style={{ ...sideLabel, bottom: 2, left: '50%', transform: 'translateX(-50%)', color: 'var(--dv-accent)' }}>{padding.b}</span>
            <span style={{ ...sideLabel, top: '50%', left: 2, transform: 'translateY(-50%)', color: 'var(--dv-accent)' }}>{padding.l}</span>
            <span style={{ ...sideLabel, top: '50%', right: 2, transform: 'translateY(-50%)', color: 'var(--dv-accent)' }}>{padding.r}</span>

            {/* Content */}
            <div
              style={{
                background: 'var(--dv-bg)',
                padding: '14px 10px',
                borderRadius: 3,
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--dv-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {size.w} × {size.h}
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          fontSize: 10,
          color: 'var(--dv-text-muted)',
        }}
      >
        <span>box-sizing</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{boxSizing}</span>
      </div>
    </div>
  );
});
BoxModelDiagram.displayName = 'BoxModelDiagram';
