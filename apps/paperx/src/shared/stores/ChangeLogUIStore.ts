/**
 * ChangeLogUIStore — owns the change-log drawer's UI state.
 *
 * State is split between two stores on purpose:
 *   - `ChangeLogService` (data layer) holds the canonical record list.
 *   - `ChangeLogUIStore` (this file) holds *view* concerns: drawer
 *     visibility, in-memory filters, and the row currently "pinned" by
 *     a locate action.
 *
 * Data filtering is implemented here (NOT delegated to
 * ChangeLogService.list) because we want substring-contains semantics
 * for selector / property; the service's list() filter is exact-match
 * and is kept that way as a stable Phase 1 contract.
 *
 * Performance guard: filteredRecords caps at 200 rows. Beyond that the
 * MobX subscription cost on every append starts to bite, and the user
 * almost certainly wants to filter or reset rather than scroll a 1k row
 * list. We keep the *most recent* 200 (sorted desc by ts).
 */
import { inject, injectable } from 'inversify';
import { makeObservable, observable, action, computed } from 'mobx';

import { TYPES } from '@/shared/di/tokens';
import type {
  ChangeRecord,
  IChangeLogService,
} from '@/shared/services/ChangeLogService';
import type { ToolMode } from '@/shared/types/modes';

/** UI-side filter set. All fields optional; absent means "match all". */
export interface ChangeLogUIFilters {
  mode?: ToolMode;
  /** Case-insensitive substring match against ChangeRecord.selector. */
  selectorContains?: string;
  /** Case-insensitive substring match against ChangeRecord.property. */
  propertyContains?: string;
  /** Inclusive lower bound on ChangeRecord.ts (ms epoch). */
  sinceTs?: number;
}

/** Hard cap on rendered rows. See file header. */
export const CHANGE_LOG_RENDER_CAP = 200;

@injectable()
export class ChangeLogUIStore {
  /**
   * Panel-level visibility — drawer rendered to viewport at all?
   * Toggled by the toolbar History button. Independent of `drawerOpen`,
   * which controls body expansion within an already-visible drawer.
   */
  drawerVisible = true;
  drawerOpen = false;
  filters: ChangeLogUIFilters = {};
  pinnedRecordId: string | null = null;

  constructor(
    @inject(TYPES.ChangeLogService) private readonly log: IChangeLogService,
  ) {
    makeObservable(this, {
      drawerVisible: observable,
      drawerOpen: observable,
      // `observable` (deep) on filters is fine — it's a flat object of
      // primitives, no DOM refs. We replace it wholesale in setFilters,
      // so reactions on individual fields fire correctly.
      filters: observable,
      pinnedRecordId: observable,
      toggleDrawerVisible: action,
      showDrawer: action,
      hideDrawer: action,
      toggleDrawer: action,
      openDrawer: action,
      closeDrawer: action,
      setFilters: action,
      clearFilters: action,
      pin: action,
      unpin: action,
      filteredRecords: computed,
      hasActiveFilter: computed,
      totalCount: computed,
    });
  }

  toggleDrawerVisible(): void {
    this.drawerVisible = !this.drawerVisible;
  }

  showDrawer(): void {
    this.drawerVisible = true;
  }

  hideDrawer(): void {
    this.drawerVisible = false;
  }

  toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
  }

  openDrawer(): void {
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
  }

  /** Merge a partial update into the current filter set. */
  setFilters(partial: Partial<ChangeLogUIFilters>): void {
    // Replace wholesale so MobX sees a single mutation. We deliberately
    // strip empty strings: `selectorContains: ''` is semantically "no
    // filter" and would otherwise cause `r.selector.includes('')` to
    // pass everything (truthy already, but we want hasActiveFilter to
    // reflect user intent honestly).
    const next: ChangeLogUIFilters = { ...this.filters };
    for (const [k, v] of Object.entries(partial) as Array<
      [keyof ChangeLogUIFilters, ChangeLogUIFilters[keyof ChangeLogUIFilters]]
    >) {
      if (v === undefined || v === '' || v === null) {
        delete (next as Record<string, unknown>)[k];
      } else {
        (next as Record<string, unknown>)[k] = v;
      }
    }
    this.filters = next;
  }

  clearFilters(): void {
    this.filters = {};
  }

  pin(id: string): void {
    this.pinnedRecordId = id;
  }

  unpin(): void {
    this.pinnedRecordId = null;
  }

  get totalCount(): number {
    return this.log.list().length;
  }

  get hasActiveFilter(): boolean {
    const f = this.filters;
    return (
      f.mode !== undefined ||
      (f.selectorContains !== undefined && f.selectorContains.length > 0) ||
      (f.propertyContains !== undefined && f.propertyContains.length > 0) ||
      f.sinceTs !== undefined
    );
  }

  /** Records after filtering, sorted desc by ts, capped at CHANGE_LOG_RENDER_CAP. */
  get filteredRecords(): readonly ChangeRecord[] {
    const all = this.log.list();
    const f = this.filters;
    const selectorNeedle = f.selectorContains?.toLowerCase();
    const propertyNeedle = f.propertyContains?.toLowerCase();
    const filtered: ChangeRecord[] = [];
    for (const r of all) {
      if (f.mode !== undefined && r.mode !== f.mode) continue;
      if (
        selectorNeedle !== undefined &&
        !r.selector.toLowerCase().includes(selectorNeedle)
      )
        continue;
      if (
        propertyNeedle !== undefined &&
        !r.property.toLowerCase().includes(propertyNeedle)
      )
        continue;
      if (f.sinceTs !== undefined && r.ts < f.sinceTs) continue;
      filtered.push(r);
    }
    // Newest first.
    filtered.sort((a, b) => b.ts - a.ts);
    if (filtered.length > CHANGE_LOG_RENDER_CAP) {
      filtered.length = CHANGE_LOG_RENDER_CAP;
    }
    return filtered;
  }
}
