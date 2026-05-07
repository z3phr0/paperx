/**
 * paperx DI container bootstrap.
 *
 * IMPORTANT: `reflect-metadata` MUST be imported exactly once, before any
 * @injectable / @inject decorator runs. The content script entry point is
 * responsible for importing this module first.
 */
import 'reflect-metadata';
import { Container } from 'inversify';

import { TYPES } from './tokens';
import { UIStore } from '@/shared/stores/UIStore';
import { SelectionStore } from '@/shared/stores/SelectionStore';
import {
  ChangeLogService,
  type IChangeLogService,
} from '@/shared/services/ChangeLogService';
import {
  StyleEditService,
  type IStyleEditService,
} from '@/shared/services/StyleEditService';

export function createContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });
  container.bind<UIStore>(TYPES.UIStore).to(UIStore).inSingletonScope();
  container
    .bind<SelectionStore>(TYPES.SelectionStore)
    .to(SelectionStore)
    .inSingletonScope();
  container
    .bind<IChangeLogService>(TYPES.ChangeLogService)
    .to(ChangeLogService)
    .inSingletonScope();
  container
    .bind<IStyleEditService>(TYPES.StyleEditService)
    .to(StyleEditService)
    .inSingletonScope();
  return container;
}

/** Singleton accessor — call this from content script bootstrap. */
let _container: Container | null = null;
export function getContainer(): Container {
  if (!_container) _container = createContainer();
  return _container;
}
