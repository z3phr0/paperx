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
  ...rest
}: InputProps): React.ReactElement {
  const [v, setV] = React.useState<string>(String(value));
  React.useEffect(() => setV(String(value)), [value]);

  return (
    <div
      className={`dv-input${containerClassName ? ` ${containerClassName}` : ''}`}
      style={flex ? { flex: 1, minWidth: 0 } : { width }}
    >
      {prefix != null && <span className="dv-input-prefix">{prefix}</span>}
      <input
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          onChange?.(e.target.value);
        }}
        placeholder={placeholder}
        className={className}
        {...rest}
      />
      {suffix != null && <span className="dv-input-suffix">{suffix}</span>}
    </div>
  );
}
