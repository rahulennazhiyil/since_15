import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FilterDefinition } from '../filters/filter.model';
import type { LayoutId } from '../photo/layouts';

export type PhotoQuality = 'full' | 'preview';

/** Metadata plus the encoded image. Blobs live only in the user's browser. */
export interface StoredPhoto {
  id: string;
  createdAt: number;
  /** Groups photos taken in one booth or room visit. */
  sessionId: string;
  roomCode: string | null;
  filterId: string;
  layoutId: LayoutId;
  /** Display names of everyone in the picture. */
  participants: string[];
  width: number;
  height: number;
  quality: PhotoQuality;
  blob: Blob;
}

export interface StoredThumb {
  photoId: string;
  blob: Blob;
}

interface BoothDB extends DBSchema {
  filters: {
    key: string;
    value: FilterDefinition;
    indexes: { createdAt: number };
  };
  photos: {
    key: string;
    value: StoredPhoto;
    indexes: { createdAt: number; sessionId: string };
  };
  thumbs: {
    key: string;
    value: StoredThumb;
  };
}

export type BoothDatabase = IDBPDatabase<BoothDB>;

const DB_NAME = 'since060815';
const DB_VERSION = 1;

let opening: Promise<BoothDatabase> | null = null;

/** Single shared connection; schema upgrades run here and only here. */
export function openBoothDb(): Promise<BoothDatabase> {
  opening ??= openDB<BoothDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const filters = db.createObjectStore('filters', { keyPath: 'id' });
      filters.createIndex('createdAt', 'createdAt');
      const photos = db.createObjectStore('photos', { keyPath: 'id' });
      photos.createIndex('createdAt', 'createdAt');
      photos.createIndex('sessionId', 'sessionId');
      db.createObjectStore('thumbs', { keyPath: 'photoId' });
    },
    blocked() {
      // Another tab holds an older version open; we keep working with the current one.
    },
    blocking() {
      // A newer version wants to open elsewhere; release so it can upgrade.
      void opening?.then((db) => db.close());
      opening = null;
    },
  });
  return opening;
}

/** Wipes every store. Used by "Clear my data". */
export async function clearBoothDb(): Promise<void> {
  const db = await openBoothDb();
  const tx = db.transaction(['filters', 'photos', 'thumbs'], 'readwrite');
  await Promise.all([tx.objectStore('filters').clear(), tx.objectStore('photos').clear(), tx.objectStore('thumbs').clear(), tx.done]);
}

/** Test seam: forget the cached connection so a fresh database can be opened. */
export function resetBoothDbForTests(): void {
  opening = null;
}
