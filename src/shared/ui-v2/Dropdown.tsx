/**
 * Dropdown — trigger pill + Radix Popover menu, matching `.dv-dropdown`
 * + `.dv-dropdown-menu` from design-v2.css.
 *
 * Portal contract (CLAUDE.md hard rule): the menu must portal into the
 * shadow-root-scoped `paperx-portal-layer` so the design-v2 stylesheet
 * applies and host-page CSS cannot bleed in.
 */
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';

import { Icon } from './Icon';
import { usePortalContainer } from '@/shared/ui/portal';

export interface DropdownItem<V extends string> {
  value: V;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface DropdownProps<V extends string> {
  value: V;
  onChange: (next: V) => void;
  items: ReadonlyArray<DropdownItem<V>>;
  /** Prefix icon rendered inside the trigger (e.g. `<Icon name="border"/>`). */
  prefix?: React.ReactNode;
  placeholder?: string;
  'data-testid'?: string;
  /**
   * When set, each menu item receives `data-testid={`${itemTestidPrefix}-${item.value}`}`
   * so e2e tests can target individual options without relying on text.
   */
  itemTestidPrefix?: string;
}

export function Dropdown<V extends string>({
  value,
  onChange,
  items,
  prefix,
  placeholder,
  itemTestidPrefix,
  ...rest
}: DropdownProps<V>): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const portalContainer = usePortalContainer();
  const current = items.find((i) => i.value === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="dv-dropdown"
          data-testid={rest['data-testid']}
        >
          {prefix}
          <span
            style={{
              flex: 1,
              textAlign: 'left',
              textTransform: 'capitalize',
              color: current ? 'var(--dv-text)' : 'var(--dv-text-muted)',
            }}
          >
            {current?.label ?? placeholder ?? ''}
          </span>
          <Icon name="caret-down" size={11} />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="dv-dropdown-menu"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it) => (
            <button
              key={it.value}
              type="button"
              className="dv-dropdown-item"
              data-active={value === it.value || undefined}
              data-value={it.value}
              data-testid={
                itemTestidPrefix ? `${itemTestidPrefix}-${it.value}` : undefined
              }
              onClick={() => {
                onChange(it.value);
                setOpen(false);
              }}
            >
              <span style={{ width: 12, opacity: value === it.value ? 1 : 0 }}>
                <Icon name="check" size={12} />
              </span>
              {it.icon}
              <span>{it.label}</span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
