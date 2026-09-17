import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_PREFIX, StorageService, type StorageKeyDef } from './storage.service';

interface V1 {
  name: string;
}
interface V2 {
  displayName: string;
  emoji: string;
}

const KEY_V1: StorageKeyDef<V1> = { key: 'thing', version: 1, defaults: () => ({ name: '' }) };
const KEY_V2: StorageKeyDef<V2> = {
  key: 'thing',
  version: 2,
  defaults: () => ({ displayName: '', emoji: '❤️' }),
  migrate: (prev, from) => {
    if (from === 1) return { displayName: (prev as V1).name, emoji: '❤️' };
    return { displayName: '', emoji: '❤️' };
  },
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  it('returns defaults when nothing is stored', () => {
    expect(service.read(KEY_V1)).toEqual({ name: '' });
  });

  it('round-trips a value inside a versioned envelope', () => {
    service.write(KEY_V1, { name: 'Sam' });
    expect(service.read(KEY_V1)).toEqual({ name: 'Sam' });
    expect(JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'thing')!)).toEqual({
      v: 1,
      data: { name: 'Sam' },
    });
  });

  it('migrates an older version and persists the migrated shape', () => {
    service.write(KEY_V1, { name: 'Sam' });
    expect(service.read(KEY_V2)).toEqual({ displayName: 'Sam', emoji: '❤️' });
    expect(JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'thing')!).v).toBe(2);
  });

  it('falls back to defaults on a version mismatch with no migration', () => {
    service.write(KEY_V2, { displayName: 'Sam', emoji: '✨' });
    expect(service.read(KEY_V1)).toEqual({ name: '' });
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(STORAGE_PREFIX + 'thing', '{not json');
    expect(service.read(KEY_V1)).toEqual({ name: '' });
  });

  it('clearAll removes only prefixed keys', () => {
    service.write(KEY_V1, { name: 'Sam' });
    localStorage.setItem('other-app', 'keep');
    service.clearAll();
    expect(localStorage.getItem(STORAGE_PREFIX + 'thing')).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('keep');
  });
});
