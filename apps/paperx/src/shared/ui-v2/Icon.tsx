/**
 * Icon — Lucide-style SVG dictionary used across the V2 inspector.
 *
 * The design handoff (figma-builder/project/icons.jsx) inlines Lucide
 * paths directly so the prototype could run without a bundler. We
 * preserve that approach here so design names map 1:1 to the spec
 * (e.g. `pad-h` / `gap-v` / `corners-individual` are custom glyphs
 * authored in the prototype that don't exist as `lucide-react` exports).
 *
 * 24px viewBox, 2px stroke, round caps/joins — Lucide defaults.
 */
import * as React from 'react';

export type IconName =
  | 'align-left'
  | 'align-h-center'
  | 'align-right'
  | 'align-top'
  | 'align-v-center'
  | 'align-bottom'
  | 'distribute-h'
  | 'flow-free'
  | 'flow-vertical'
  | 'flow-horizontal'
  | 'flow-grid'
  | 'rotate'
  | 'rotate-icon'
  | 'flip-h'
  | 'flip-v'
  | 'resize'
  | 'locate'
  | 'maximize'
  | 'collapse'
  | 'gap-h'
  | 'gap-v'
  | 'pad-h'
  | 'pad-v'
  | 'pad-all'
  | 'corner'
  | 'corners-individual'
  | 'eye'
  | 'eye-off'
  | 'opacity'
  | 'plus'
  | 'minus'
  | 'check'
  | 'caret-down'
  | 'sliders'
  | 'copy'
  | 'shadow'
  | 'border'
  | 'image'
  | 'pin'
  | 'palette'
  | 'ruler'
  | 'message-square'
  | 'clipboard'
  | 'link'
  | 'reset'
  | 'download'
  | 'upload'
  | 'x';

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

const PATHS: Record<IconName, React.ReactElement> = {
  // Alignment (outline; thin 1.25 stroke)
  'align-left': (
    <>
      <rect x="3" y="4" width="16" height="6" rx="1.5" strokeWidth="1.25" />
      <rect x="3" y="14" width="10" height="6" rx="1.5" strokeWidth="1.25" />
    </>
  ),
  'align-h-center': (
    <>
      <rect x="4" y="4" width="16" height="6" rx="1.5" strokeWidth="1.25" />
      <rect x="7" y="14" width="10" height="6" rx="1.5" strokeWidth="1.25" />
    </>
  ),
  'align-right': (
    <>
      <rect x="5" y="4" width="16" height="6" rx="1.5" strokeWidth="1.25" />
      <rect x="11" y="14" width="10" height="6" rx="1.5" strokeWidth="1.25" />
    </>
  ),
  'align-top': (
    <>
      <rect x="4" y="3" width="6" height="16" rx="1.5" strokeWidth="1.25" />
      <rect x="14" y="3" width="6" height="10" rx="1.5" strokeWidth="1.25" />
    </>
  ),
  'align-v-center': (
    <>
      <rect x="4" y="4" width="6" height="16" rx="1.5" strokeWidth="1.25" />
      <rect x="14" y="7" width="6" height="10" rx="1.5" strokeWidth="1.25" />
    </>
  ),
  'align-bottom': (
    <>
      <rect x="4" y="5" width="6" height="16" rx="1.5" strokeWidth="1.25" />
      <rect x="14" y="11" width="6" height="10" rx="1.5" strokeWidth="1.25" />
    </>
  ),
  'distribute-h': (
    <>
      <rect width="6" height="14" x="4" y="5" rx="1" />
      <rect width="6" height="10" x="14" y="7" rx="1" />
      <path d="M2 2v20" />
      <path d="M22 2v20" />
    </>
  ),

  // Flow modes
  'flow-free': (
    <>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
    </>
  ),
  'flow-vertical': (
    <>
      <rect width="18" height="7" x="3" y="3" rx="1" />
      <rect width="18" height="7" x="3" y="14" rx="1" />
    </>
  ),
  'flow-horizontal': (
    <>
      <rect width="7" height="18" x="3" y="3" rx="1" />
      <rect width="7" height="18" x="14" y="3" rx="1" />
    </>
  ),
  'flow-grid': (
    <>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </>
  ),

  // Rotation / flip
  rotate: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.74 9.74 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  'rotate-icon': (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.74 9.74 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  'flip-h': (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M12 20v2" />
      <path d="M12 14v2" />
      <path d="M12 8v2" />
      <path d="M12 2v2" />
    </>
  ),
  'flip-v': (
    <>
      <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
      <path d="M4 12H2" />
      <path d="M10 12H8" />
      <path d="M16 12h-2" />
      <path d="M22 12h-2" />
    </>
  ),

  // Layout / resize
  resize: (
    <>
      <path d="m21 11-3-3m0 0-3 3m3-3v6m-3 6 3 3m0 0 3-3m-3 3V9" />
      <path d="M3 21V9" />
      <path d="M3 9h6" />
      <path d="M3 21h6" />
    </>
  ),
  locate: (
    <>
      <line x1="2" x2="5" y1="12" y2="12" />
      <line x1="19" x2="22" y1="12" y2="12" />
      <line x1="12" x2="12" y1="2" y2="5" />
      <line x1="12" x2="12" y1="19" y2="22" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  maximize: (
    <>
      <path d="M3 3h6" />
      <path d="M9 3v6" />
      <path d="M3 21h6" />
      <path d="M9 21v-6" />
      <path d="M21 3h-6" />
      <path d="M15 3v6" />
      <path d="M21 21h-6" />
      <path d="M15 21v-6" />
    </>
  ),
  collapse: (
    <>
      <path d="m4 14 6 0 0 6" />
      <path d="M20 10h-6V4" />
      <path d="m14 10 7-7" />
      <path d="m3 21 7-7" />
    </>
  ),
  'gap-h': (
    <>
      <path d="M9 3v18" />
      <path d="M15 3v18" />
      <path d="M3 12h6" />
      <path d="M15 12h6" />
    </>
  ),
  'gap-v': (
    <>
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M12 3v6" />
      <path d="M12 15v6" />
    </>
  ),
  'pad-h': (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 7v10" />
      <path d="M17 7v10" />
    </>
  ),
  'pad-v': (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 7h10" />
      <path d="M7 17h10" />
    </>
  ),
  'pad-all': (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <rect width="8" height="8" x="8" y="8" rx="1" />
    </>
  ),
  corner: <path d="M22 3H7a4 4 0 0 0-4 4v14" />,
  'corners-individual': (
    <>
      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </>
  ),

  // Visibility / style
  eye: (
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </>
  ),
  opacity: (
    <path d="M12 22a7 7 0 0 1-7-7c0-2 1-3.9 3-5.5s3.5-4 4-6.5c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 0 1-7 7z" />
  ),
  plus: <path d="M5 12h14M12 5v14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M20 6 9 17l-5-5" />,
  'caret-down': <path d="m6 9 6 6 6-6" />,
  sliders: (
    <>
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
    </>
  ),
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>
  ),
  shadow: (
    <>
      <rect width="14" height="14" x="3" y="3" rx="2" />
      <rect
        width="14"
        height="14"
        x="7"
        y="7"
        rx="2"
        fill="currentColor"
        opacity="0.25"
        stroke="none"
      />
    </>
  ),
  border: (
    <rect width="18" height="18" x="3" y="3" rx="2" strokeDasharray="3 2" />
  ),
  image: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>
  ),
  pin: (
    <>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </>
  ),
  palette: (
    <>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </>
  ),
  ruler: (
    <>
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
      <path d="m14.5 12.5 2-2" />
      <path d="m11.5 9.5 2-2" />
      <path d="m8.5 6.5 2-2" />
      <path d="m17.5 15.5 2-2" />
    </>
  ),
  'message-square': (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  clipboard: (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  // Lucide rotate-ccw — used by Comment v2 list item "Reopen" action.
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  // Lucide download — used by Comment v2 panel "Export JSON" header action.
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </>
  ),
  // Lucide upload — used by Comment v2 panel "Import JSON" header action.
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </>
  ),
  // Lucide x — used by Comment v2 composer + delete button.
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
};

export function Icon({
  name,
  size = 14,
  strokeWidth = 2,
  className,
  style,
}: IconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
