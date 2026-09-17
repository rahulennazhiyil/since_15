import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../errors/app-error';
import { prepareBackground } from '../scene/background-import';
import { BackgroundResolver } from '../scene/background-resolver';
import { openBoothDb, type StoredBackground } from './db';

export type BackgroundMeta = Omit<StoredBackground, 'blob'>;

const MAX_CUSTOM = 12;

/**
 * Backgrounds the user brought in (or received from their partner), persisted in
 * IndexedDB. Registers itself with the BackgroundResolver so the scene can draw them by id.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundStore {
  private readonly resolver = inject(BackgroundResolver);
  private readonly _items = signal<BackgroundMeta[]>([]);
  private readonly _loaded = signal(false);
  private readonly urls = new Map<string, string>();
  private loading: Promise<void> | null = null;

  readonly items = this._items.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  /** Newest first; what the picker shows as "Your photo" tiles. */
  readonly mine = computed(() => this._items().filter((b) => b.origin === 'mine'));

  constructor() {
    this.resolver.registerCustomSource((id) => this.getBlob(id));
    inject(DestroyRef).onDestroy(() => this.urls.forEach((u) => URL.revokeObjectURL(u)));
  }

  /** Loads once; later calls return the same promise. */
  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  /** Imports a picked file: downscale, hash, store. Returns the stored record. */
  async importFile(file: Blob): Promise<StoredBackground> {
    const prepared = await prepareBackground(file);
    return this.put({ ...prepared, createdAt: Date.now(), origin: 'mine' });
  }

  /** Stores bytes that arrived from the partner; no-op when we already have them. */
  async saveFromPartner(id: string, blob: Blob, width: number, height: number): Promise<StoredBackground> {
    const existing = await this.getBlob(id);
    if (existing) return { id, blob: existing, width, height, createdAt: Date.now(), origin: 'partner' };
    return this.put({ id, blob, width, height, createdAt: Date.now(), origin: 'partner' });
  }

  async getBlob(id: string): Promise<Blob | null> {
    try {
      const db = await openBoothDb();
      return (await db.get('backgrounds', id))?.blob ?? null;
    } catch {
      return null;
    }
  }

  /** Object URL for a tile; cached and revoked with the store. */
  async urlFor(id: string): Promise<string | null> {
    const hit = this.urls.get(id);
    if (hit) return hit;
    const blob = await this.getBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.urls.set(id, url);
    return url;
  }

  async remove(id: string): Promise<void> {
    try {
      const db = await openBoothDb();
      await db.delete('backgrounds', id);
    } catch (error) {
      throw new AppError('storage-failed', { cause: error });
    }
    const url = this.urls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(id);
    this.resolver.invalidate(id);
    this._items.update((items) => items.filter((b) => b.id !== id));
  }

  /** Test seam and "Clear my data": forget everything in memory. */
  resetAfterWipe(): void {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls.clear();
    this._items.set([]);
  }

  private async put(record: StoredBackground): Promise<StoredBackground> {
    try {
      const db = await openBoothDb();
      await db.put('backgrounds', record);
      // Keep the collection small: drop the oldest of mine beyond the cap.
      const mine = this._items()
        .filter((b) => b.origin === 'mine' && b.id !== record.id)
        .sort((a, b) => b.createdAt - a.createdAt);
      for (const old of mine.slice(MAX_CUSTOM - 1)) await db.delete('backgrounds', old.id).catch(() => undefined);
      const { blob: _blob, ...meta } = record;
      this._items.update((items) => [meta, ...items.filter((b) => b.id !== record.id && !mine.slice(MAX_CUSTOM - 1).some((o) => o.id === b.id))]);
      this.resolver.invalidate(record.id);
      return record;
    } catch (error) {
      throw new AppError('storage-failed', { cause: error });
    }
  }

  private async doLoad(): Promise<void> {
    try {
      const db = await openBoothDb();
      const all = await db.getAllFromIndex('backgrounds', 'createdAt');
      this._items.set(all.map(({ blob: _blob, ...meta }) => meta).sort((a, b) => b.createdAt - a.createdAt));
    } catch {
      // Storage unavailable: built-in backgrounds still work.
      this._items.set([]);
    } finally {
      this._loaded.set(true);
    }
  }
}
