import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { TestBed } from '@angular/core/testing';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { BackgroundResolver } from '../scene/background-resolver';
import { BackgroundStore } from './background-store';
import { DB_NAME, clearBoothDb, openBoothDb, resetBoothDbForTests } from './db';

describe('BackgroundStore and the v2 schema', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    resetBoothDbForTests();
    TestBed.configureTestingModule({});
  });

  it('upgrades a version 1 database without touching the old stores', async () => {
    // A database created by the previous release: three stores, one filter in it.
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('filters', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('createdAt', 'createdAt');
        photos.createIndex('sessionId', 'sessionId');
        db.createObjectStore('thumbs', { keyPath: 'photoId' });
      },
    });
    await v1.put('filters', { id: 'f1', name: 'Old', createdAt: 1 });
    v1.close();

    const db = await openBoothDb();
    expect(db.version).toBe(2);
    expect(Array.from(db.objectStoreNames).sort()).toEqual(['backgrounds', 'filters', 'photos', 'thumbs']);
    expect((await db.get('filters', 'f1'))?.name).toBe('Old');
    await db.put('backgrounds', { id: 'custom:abc', createdAt: 2, width: 10, height: 10, origin: 'mine', blob: new Blob(['x']) });
    expect(await db.count('backgrounds')).toBe(1);
    await clearBoothDb();
    expect(await db.count('backgrounds')).toBe(0);
    expect(await db.count('filters')).toBe(0);
  });

  it('stores partner backgrounds once, lists mine newest first and serves the resolver', async () => {
    const store = TestBed.inject(BackgroundStore);
    const resolver = TestBed.inject(BackgroundResolver);
    await store.load();
    expect(store.items()).toEqual([]);

    await store.saveFromPartner('custom:p1', new Blob(['partner']), 100, 80);
    await store.saveFromPartner('custom:p1', new Blob(['partner-again']), 100, 80);
    const db = await openBoothDb();
    expect(await db.count('backgrounds')).toBe(1);
    expect(store.items().map((b) => b.origin)).toEqual(['partner']);
    expect(store.mine()).toEqual([]);

    // The resolver's custom source is this store.
    const blob = await (resolver as unknown as { customSource: (id: string) => Promise<Blob | null> }).customSource('custom:p1');
    expect(blob).not.toBeNull();
    expect(await store.getBlob('custom:missing')).toBeNull();

    await store.remove('custom:p1');
    expect(store.items()).toEqual([]);
    expect(await db.count('backgrounds')).toBe(0);
  });
});
