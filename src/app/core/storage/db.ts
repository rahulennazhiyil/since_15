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

/** A background photo the user (or their partner) brought into the scene. */
export interface StoredBackground {
  /** `custom:<hash>`, identical on both devices for the same bytes. */
  id: string;
  createdAt: number;
  width: number;
  height: number;
  /** Who brought it: this device or the partner over the room connection. */
  origin: 'mine' | 'partner';
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
  backgrounds: {
    key: string;
    value: StoredBackground;
    indexes: { createdAt: number };
  };
}

export type BoothDatabase = IDBPDatabase<BoothDB>;

export const DB_NAME = 'since060815';
export const DB_VERSION = 2;
const ALL_STORES = ['filters', 'photos', 'thumbs', 'backgrounds'] as const;

let opening: Promise<BoothDatabase> | null = null;

/** Single shared connection; schema upgrades run here and only here, one version at a time. */
export function openBoothDb(): Promise<BoothDatabase> {
  opening ??= openDB<BoothDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const filters = db.createObjectStore('filters', { keyPath: 'id' });
        filters.createIndex('createdAt', 'createdAt');
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('createdAt', 'createdAt');
        photos.createIndex('sessionId', 'sessionId');
        db.createObjectStore('thumbs', { keyPath: 'photoId' });
      }
      if (oldVersion < 2) {
        const backgrounds = db.createObjectStore('backgrounds', { keyPath: 'id' });
        backgrounds.createIndex('createdAt', 'createdAt');
      }
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
  const tx = db.transaction(ALL_STORES, 'readwrite');
  await Promise.all([...ALL_STORES.map((name) => tx.objectStore(name).clear()), tx.done]);
}

/** Test seam: forget the cached connection so a fresh database can be opened. */
export function resetBoothDbForTests(): void {
  opening = null;
}
