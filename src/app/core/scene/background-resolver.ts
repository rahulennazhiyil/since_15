import { Injectable } from '@angular/core';
import { NO_BACKGROUND_ID, findBackground, isCustomBackgroundId } from './background-catalog';

/** Supplies the bytes of a custom background by id (the store registers itself here). */
export type CustomBackgroundSource = (id: string) => Promise<Blob | null>;

const CACHE_SIZE = 4;

/**
 * Turns a background id into a decoded image, with a tiny cache. Built-ins come from our
 * own origin; custom ones from whatever source registered (IndexedDB). Never throws:
 * an unknown id resolves to null, which draws as a plain surface.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundResolver {
  private readonly cache = new Map<string, Promise<ImageBitmap | null>>();
  private customSource: CustomBackgroundSource | null = null;

  registerCustomSource(source: CustomBackgroundSource): void {
    this.customSource = source;
  }

  /** Forget a cached custom image (after delete or replace). */
  invalidate(id: string): void {
    void this.cache.get(id)?.then((bmp) => bmp?.close());
    this.cache.delete(id);
  }

  resolve(id: string): Promise<ImageBitmap | null> {
    if (id === NO_BACKGROUND_ID) return Promise.resolve(null);
    const hit = this.cache.get(id);
    if (hit) return hit;
    const pending = this.load(id).catch(() => null);
    this.cache.set(id, pending);
    if (this.cache.size > CACHE_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined && oldest !== id) this.invalidate(oldest);
    }
    return pending;
  }

  /** Same as resolve but for the small thumbnail of a built-in. */
  async resolveThumb(id: string): Promise<ImageBitmap | null> {
    const def = findBackground(id);
    if (!def) return this.resolve(id);
    return fetchBitmap(new URL(def.thumb, document.baseURI).toString()).catch(() => null);
  }

  private async load(id: string): Promise<ImageBitmap | null> {
    if (isCustomBackgroundId(id)) {
      const blob = await this.customSource?.(id);
      return blob ? createImageBitmap(blob) : null;
    }
    const def = findBackground(id);
    if (!def) return null;
    return fetchBitmap(new URL(def.src, document.baseURI).toString());
  }
}

async function fetchBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`background ${response.status}`);
  return createImageBitmap(await response.blob());
}
