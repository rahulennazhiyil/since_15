import { Injectable, computed, signal } from '@angular/core';
import { AppError } from '../errors/app-error';
import { canvasToBlob, createCanvas, fitWithin } from '../photo/image-encode';
import type { LayoutId } from '../photo/layouts';
import { openBoothDb, type PhotoQuality, type StoredPhoto } from './db';

/** Everything about a photo except its bytes; what lists and grids render from. */
export type PhotoMeta = Omit<StoredPhoto, 'blob'>;

export interface SavePhotoInput {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  sessionId: string;
  roomCode: string | null;
  filterId: string;
  layoutId: LayoutId;
  participants: string[];
  quality: PhotoQuality;
  createdAt?: number;
}

const THUMB_EDGE = 320;
const THUMB_QUALITY = 0.8;
/** Warn when the origin's storage is this full. */
const STORAGE_WARN_RATIO = 0.8;

/**
 * Local photo library in IndexedDB. Blobs are loaded on demand; metadata lives in a
 * signal so galleries update instantly. Nothing here talks to a network.
 */
@Injectable({ providedIn: 'root' })
export class PhotoStore {
  private readonly _photos = signal<PhotoMeta[]>([]);
  private readonly _loaded = signal(false);
  private loading: Promise<void> | null = null;

  /** Newest first. */
  readonly photos = this._photos.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly count = computed(() => this._photos().length);

  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  /** Inserts or replaces (same id) and refreshes the cached thumbnail. */
  async save(input: SavePhotoInput): Promise<PhotoMeta> {
    const record: StoredPhoto = { ...input, createdAt: input.createdAt ?? Date.now() };
    try {
      const db = await openBoothDb();
      await db.put('photos', record);
      await db.delete('thumbs', record.id);
    } catch (error) {
      throw new AppError('storage-failed', { cause: error });
    }
    const { blob: _blob, ...meta } = record;
    this._photos.update((list) => [meta, ...list.filter((p) => p.id !== meta.id)].sort(byNewest));
    return meta;
  }

  async remove(id: string): Promise<void> {
    try {
      const db = await openBoothDb();
      const tx = db.transaction(['photos', 'thumbs'], 'readwrite');
      await Promise.all([tx.objectStore('photos').delete(id), tx.objectStore('thumbs').delete(id), tx.done]);
    } catch (error) {
      throw new AppError('storage-failed', { cause: error });
    }
    this._photos.update((list) => list.filter((p) => p.id !== id));
  }

  async getBlob(id: string): Promise<Blob | null> {
    try {
      const db = await openBoothDb();
      return (await db.get('photos', id))?.blob ?? null;
    } catch {
      return null;
    }
  }

  /** Small JPEG for grids, generated once and cached. Falls back to the full image. */
  async getThumbnail(id: string): Promise<Blob | null> {
    try {
      const db = await openBoothDb();
      const cached = await db.get('thumbs', id);
      if (cached) return cached.blob;
      const photo = await db.get('photos', id);
      if (!photo) return null;
      const thumb = await makeThumb(photo.blob, photo.width, photo.height);
      if (thumb !== photo.blob) await db.put('thumbs', { photoId: id, blob: thumb });
      return thumb;
    } catch {
      return null;
    }
  }

  bySession(sessionId: string): PhotoMeta[] {
    return this._photos().filter((p) => p.sessionId === sessionId);
  }

  /** Fraction of the origin's quota in use, or null when the browser will not say. */
  async usageRatio(): Promise<number | null> {
    try {
      const est = await navigator.storage?.estimate?.();
      if (!est?.quota || est.usage === undefined) return null;
      return est.usage / est.quota;
    } catch {
      return null;
    }
  }

  async isNearlyFull(): Promise<boolean> {
    const ratio = await this.usageRatio();
    return ratio !== null && ratio >= STORAGE_WARN_RATIO;
  }

  /** Forget everything in memory after the database was wiped elsewhere. */
  resetAfterWipe(): void {
    this._photos.set([]);
  }

  private async doLoad(): Promise<void> {
    try {
      const db = await openBoothDb();
      const all = await db.getAllFromIndex('photos', 'createdAt');
      this._photos.set(all.map(({ blob: _blob, ...meta }) => meta).sort(byNewest));
    } catch {
      this._photos.set([]);
    } finally {
      this._loaded.set(true);
    }
  }
}

function byNewest(a: PhotoMeta, b: PhotoMeta): number {
  return b.createdAt - a.createdAt;
}

async function makeThumb(blob: Blob, width: number, height: number): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return blob;
  const size = fitWithin(width, height, THUMB_EDGE);
  if (size.width === width && size.height === height) return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = createCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    return await canvasToBlob(canvas, 'image/jpeg', THUMB_QUALITY);
  } finally {
    bitmap.close();
  }
}
