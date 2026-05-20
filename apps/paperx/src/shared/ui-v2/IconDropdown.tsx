/**
 * IconDropdown — icon-trigger variant of `Dropdown`. The trigger is a
 * fixed `<IconButton>` whose glyph does not change with `value`
 * (Figma-style style switcher). The menu reuses `.dv-dropdown-menu` /
 * `.dv-dropdown-item` so portal contract + visual stay identical to
 * `Dropdown`.
 */
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';

import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import type { DropdownItem } from './Dropdown';
import { usePortalContainer } from '@/shared/ui/portal';

export interface IconDropdownProps<V extends string> {
  icon: IconName;
  title?: string;
  value: V;
  onChange: (next: V) => void;
  items: ReadonlyArray<DropdownItem<V>>;
  'data-testid'?: string;
  itemTestidPrefix?: string;
}

export function IconDropdown<V extends string>({
  icon,
  title,
  value,
  onChange,
  items,
  itemTestidPrefix,
  ...rest
}: IconDropdownProps<V>): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const portalContainer = usePortalContainer();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <IconButton
          icon={icon}
          title={title}
          data-testid={rest['data-testid']}
        />
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Content
          align="end"
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
