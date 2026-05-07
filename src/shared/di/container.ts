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
import {
  ChangeLogService,
  type IChangeLogService,
} from '@/shared/services/ChangeLogService';

export function createContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });
  container.bind<UIStore>(TYPES.UIStore).to(UIStore).inSingletonScope();
  container
    .bind<IChangeLogService>(TYPES.ChangeLogService)
    .to(ChangeLogService)
    .inSingletonScope();
  return container;
}

/** Singleton accessor — call this from content script bootstrap. */
let _container: Container | null = null;
export function getContainer(): Container {
  if (!_container) _container = createContainer();
  return _container;
}
