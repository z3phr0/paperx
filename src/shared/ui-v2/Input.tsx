/**
 * Input — text field with optional prefix/suffix slots, matching
 * `.dv-input` from design-v2.css. Mirrors the design spec's primitives.jsx
 * shape: prefix can be a string (rendered in muted weight) or a React
 * node (e.g. an <Icon/>); suffix renders the unit (`px` / `%` / `°`).
 *
 * Uncontrolled-to-controlled bridge: the prop `value` is the canonical
 * source; we mirror it locally so the field reflects user keystrokes
 * even before the parent commits. Commit semantics are owned by the
 * parent via `onChange` — same as primitives.jsx#L39-58.
 */
import * as React from 'react';

export interface InputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'prefix' | 'value' | 'onChange'
  > {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  value: string | number;
  onChange?: (next: string) => void;
  /** When set, the input fills its parent flexbox column. Default true. */
  flex?: boolean;
  /** Fixed pixel width when `flex={false}`. */
  width?: number;
  containerClassName?: string;
  /**
   * Enable design-tool keyboard nudging. When true (default), pressing
   * `ArrowUp` / `ArrowDown` parses the leading number from the current
   * value and commits `±1` (or `±10` with `Shift`). Opt out for text
   * fields (filenames, CSS shorthand strings, etc.).
   */
  numeric?: boolean;
}

export function Input({
  prefix,
  suffix,
  value,
  onChange,
  placeholder,
  flex = true,
  width,
  className,
  containerClassName,
  numeric = true,
  ...rest
}: InputProps): React.ReactElement {
  const [v, setV] = React.useState<string>(String(value));
  React.useEffect(() => setV(String(value)), [value]);

  // Surface data-testid on the wrapper, not on the inner <input>, so
  // tests can locate the field and then drill into the `input` child.
  // Spreading the testid onto the bare input forces tests to special-case
  // a leaf locator, which loses the wrapper as a queryable anchor.
  const { ['data-testid']: testid, onKeyDown: callerOnKeyDown, ...inputRest } =
    rest as {
      'data-testid'?: string;
      onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    } & typeof rest;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    callerOnKeyDown?.(e);
    if (e.defaultPrevented || !numeric) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const sign = e.key === 'ArrowUp' ? 1 : -1;
    const delta = e.shiftKey ? 10 : 1;
    const m = v.match(/^(-?[\d.]+)/);
    const cur = m && m[1] != null ? parseFloat(m[1]) : 0;
    const nextNum = Math.round(cur + sign * delta);
    const next = String(nextNum);
    setV(next);
    onChange?.(next);
  };

  return (
    <div
      className={`dv-input${containerClassName ? ` ${containerClassName}` : ''}`}
      style={flex ? { flex: 1, minWidth: 0 } : { width }}
      data-testid={testid}
    >
      {prefix != null && <span className="dv-input-prefix">{prefix}</span>}
      <input
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          onChange?.(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        {...inputRest}
      />
      {suffix != null && <span className="dv-input-suffix">{suffix}</span>}
    </div>
  );
}
