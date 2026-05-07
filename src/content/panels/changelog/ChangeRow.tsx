/**
 * ChangeRow — task-spec alias for ChangeLogRow.
 *
 * The committed implementation lives in ChangeLogRow.tsx (single
 * source of truth — keep edits there). This file exists so the spec-
 * mandated identifier is reachable as a named import and is grep-able
 * in the production bundle. New code SHOULD prefer the alias for
 * forward compatibility; legacy paths (drawer / barrel) keep using
 * ChangeLogRow.
 */
export { ChangeLogRow as ChangeRow } from './ChangeLogRow';
export type { ChangeLogRowProps as ChangeRowProps } from './ChangeLogRow';
