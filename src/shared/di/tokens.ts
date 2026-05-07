/**
 * Inversify DI tokens.
 *
 * Convention: `TYPES.XxxStore` for MobX stores, `TYPES.XxxService` for
 * service classes. Symbols (not strings) so we never collide.
 */
export const TYPES = {
  UIStore: Symbol.for('paperx.UIStore'),
  ChangeLogService: Symbol.for('paperx.ChangeLogService'),
  SelectionStore: Symbol.for('paperx.SelectionStore'),
  StyleEditService: Symbol.for('paperx.StyleEditService'),
} as const;
