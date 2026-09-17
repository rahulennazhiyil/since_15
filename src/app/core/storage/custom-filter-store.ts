import { Injectable, inject, signal } from '@angular/core';
import { AppError } from '../errors/app-error';
import { FilterCatalog } from '../filters/filter-catalog.service';
import type { FilterDefinition } from '../filters/filter.model';
import { openBoothDb } from './db';

/**
 * The user's own filters, persisted in IndexedDB. Keeps the FilterCatalog in sync so
 * the rest of the app never knows where a filter came from.
 */
@Injectable({ providedIn: 'root' })
export class CustomFilterStore {
  private readonly catalog = inject(FilterCatalog);
  private readonly _filters = signal<FilterDefinition[]>([]);
  private readonly _loaded = signal(false);
  private loading: Promise<void> | null = null;

  readonly filters = this._filters.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** Loads once; later calls return the same promise. */
  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  async save(filter: FilterDefinition): Promise<void> {
    const record: FilterDefinition = {
      ...filter,
      category: 'custom',
      isCustom: true,
      createdAt: filter.createdAt ?? Date.now(),
    };
    try {
      const db = await openBoothDb();
      await db.put('filters', record);
    } catch (error) {
      throw new AppError('storage-failed', { cause: error });
    }
    this.publish([...this._filters().filter((f) => f.id !== record.id), record]);
  }

  async remove(id: string): Promise<void> {
    try {
      const db = await openBoothDb();
      await db.delete('filters', id);
    } catch (error) {
      throw new AppError('storage-failed', { cause: error });
    }
    this.publish(this._filters().filter((f) => f.id !== id));
  }

  find(id: string): FilterDefinition | undefined {
    return this._filters().find((f) => f.id === id);
  }

  private async doLoad(): Promise<void> {
    try {
      const db = await openBoothDb();
      const all = await db.getAllFromIndex('filters', 'createdAt');
      this.publish(all);
    } catch {
      // Storage unavailable (private mode, quota): the app works with presets only.
      this.publish([]);
    } finally {
      this._loaded.set(true);
    }
  }

  private publish(filters: FilterDefinition[]): void {
    const sorted = [...filters].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    this._filters.set(sorted);
    this.catalog.setCustom(sorted);
  }
}
