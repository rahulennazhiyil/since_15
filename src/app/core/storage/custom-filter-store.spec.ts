import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FilterCatalog } from '../filters/filter-catalog.service';
import { createFilter } from '../filters/filter.model';
import { CustomFilterStore } from './custom-filter-store';
import { resetBoothDbForTests } from './db';

describe('CustomFilterStore', () => {
  let store: CustomFilterStore;
  let catalog: FilterCatalog;

  beforeEach(() => {
    // Fresh database per test.
    globalThis.indexedDB = new IDBFactory();
    resetBoothDbForTests();
    TestBed.configureTestingModule({});
    store = TestBed.inject(CustomFilterStore);
    catalog = TestBed.inject(FilterCatalog);
  });

  it('loads empty and marks itself loaded', async () => {
    await store.load();
    expect(store.filters()).toEqual([]);
    expect(store.loaded()).toBe(true);
  });

  it('saves, marks the filter custom and publishes it to the catalog', async () => {
    await store.load();
    await store.save(createFilter({ id: 'mine-1', name: 'Mine', category: 'natural', adjustments: { contrast: 1.2 } }));
    const saved = store.find('mine-1');
    expect(saved?.isCustom).toBe(true);
    expect(saved?.category).toBe('custom');
    expect(saved?.createdAt).toBeTypeOf('number');
    expect(catalog.find('mine-1').adjustments.contrast).toBe(1.2);
    expect(catalog.categories().some((c) => c.id === 'custom')).toBe(true);
  });

  it('persists across a reload of the store', async () => {
    await store.load();
    await store.save(createFilter({ id: 'a', name: 'A', category: 'custom', createdAt: 2 }));
    await store.save(createFilter({ id: 'b', name: 'B', category: 'custom', createdAt: 1 }));

    resetBoothDbForTests();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(CustomFilterStore);
    await fresh.load();
    expect(fresh.filters().map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('overwrites a filter with the same id', async () => {
    await store.load();
    await store.save(createFilter({ id: 'a', name: 'First', category: 'custom' }));
    await store.save(createFilter({ id: 'a', name: 'Second', category: 'custom' }));
    expect(store.filters()).toHaveLength(1);
    expect(store.find('a')?.name).toBe('Second');
  });

  it('removes a filter and the catalog falls back to Original for its id', async () => {
    await store.load();
    await store.save(createFilter({ id: 'gone', name: 'Gone', category: 'custom' }));
    await store.remove('gone');
    expect(store.find('gone')).toBeUndefined();
    expect(catalog.find('gone').id).toBe('original');
  });
});
