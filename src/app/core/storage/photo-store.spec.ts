import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearBoothDb, resetBoothDbForTests } from './db';
import { PhotoStore, type SavePhotoInput } from './photo-store';

function input(id: string, createdAt: number, sessionId = 's1'): SavePhotoInput {
  return {
    id,
    blob: new Blob([id], { type: 'image/jpeg' }),
    width: 10,
    height: 10,
    sessionId,
    roomCode: null,
    filterId: 'original',
    layoutId: 'single',
    participants: ['Me'],
    quality: 'full',
    createdAt,
  };
}

describe('PhotoStore', () => {
  let store: PhotoStore;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    resetBoothDbForTests();
    TestBed.configureTestingModule({});
    store = TestBed.inject(PhotoStore);
  });

  it('loads empty', async () => {
    await store.load();
    expect(store.photos()).toEqual([]);
    expect(store.loaded()).toBe(true);
  });

  it('saves and lists newest first without blobs in the metadata', async () => {
    await store.load();
    await store.save(input('a', 1000));
    await store.save(input('b', 3000));
    await store.save(input('c', 2000));
    expect(store.photos().map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect('blob' in store.photos()[0]).toBe(false);
    expect(store.count()).toBe(3);
  });

  it('replaces a photo with the same id (re-filtered)', async () => {
    await store.load();
    await store.save(input('a', 1000));
    await store.save({ ...input('a', 1000), filterId: 'mono' });
    expect(store.photos()).toHaveLength(1);
    expect(store.photos()[0].filterId).toBe('mono');
    // fake-indexeddb cannot clone Blob contents; real browsers keep the bytes.
    expect(await store.getBlob('a')).not.toBeNull();
  });

  it('filters by session and removes', async () => {
    await store.load();
    await store.save(input('a', 1, 'room-1'));
    await store.save(input('b', 2, 'room-2'));
    expect(store.bySession('room-1').map((p) => p.id)).toEqual(['a']);
    await store.remove('a');
    expect(store.photos().map((p) => p.id)).toEqual(['b']);
    expect(await store.getBlob('a')).toBeNull();
  });

  it('persists across a fresh store instance', async () => {
    await store.load();
    await store.save(input('a', 1));
    resetBoothDbForTests();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(PhotoStore);
    await fresh.load();
    expect(fresh.photos().map((p) => p.id)).toEqual(['a']);
  });

  it('returns a thumbnail (the stored image when no canvas is available)', async () => {
    await store.load();
    await store.save(input('a', 1));
    expect(await store.getThumbnail('a')).not.toBeNull();
    expect(await store.getThumbnail('missing')).toBeNull();
  });

  it('is empty after the database is wiped', async () => {
    await store.load();
    await store.save(input('a', 1));
    await clearBoothDb();
    store.resetAfterWipe();
    expect(store.photos()).toEqual([]);
    expect(await store.getBlob('a')).toBeNull();
  });
});
