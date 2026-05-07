/**
 * FilterBar — task-spec alias for the change-log header + filters
 * combo.
 *
 * The committed implementation splits the drawer\'s top strip into
 * two components: ChangeLogHeader (title + counts + action buttons)
 * and ChangeLogFilters (mode select + selector / property substring
 * inputs). The S2-A spec calls this combination "FilterBar" — this
 * file presents that aggregated identifier so the production bundle
 * is grep-able by the spec name and so external test harnesses can
 * import a single component.
 *
 * The default render simply stacks the two underlying components;
 * their own observer/MobX bindings keep them reactive without extra
 * wiring.
 */
import { observer } from 'mobx-react-lite';

import {
  ChangeLogHeader,
  type ChangeLogHeaderProps,
} from './ChangeLogHeader';
import {
  ChangeLogFilters,
  type ChangeLogFiltersProps,
} from './ChangeLogFilters';

export interface FilterBarProps
  extends ChangeLogHeaderProps,
    Pick<ChangeLogFiltersProps, 'uiStore'> {
  /** Mirror of `filtersVisible` so the parent controls expansion. */
  filtersVisible: boolean;
}

export const FilterBar = observer(function FilterBar(props: FilterBarProps) {
  const { filtersVisible, uiStore, ...headerProps } = props;
  return (
    <>
      <ChangeLogHeader
        {...headerProps}
        uiStore={uiStore}
        filtersVisible={filtersVisible}
      />
      {filtersVisible && <ChangeLogFilters uiStore={uiStore} />}
    </>
  );
});
FilterBar.displayName = 'FilterBar';
