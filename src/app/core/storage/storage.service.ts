import { Injectable } from '@angular/core';

/** Every stored value is wrapped so it can be migrated when its shape changes. */
export interface StorageEnvelope<T> {
  v: number;
  data: T;
}

/**
 * Describes one localStorage key. `migrate` receives the previously stored data and
 * its version and must return data in the current shape. Missing or corrupt values
 * fall back to `defaults()` so callers never handle null.
 */
export interface StorageKeyDef<T> {
  key: string;
  version: number;
  defaults: () => T;
  migrate?: (previous: unknown, fromVersion: number) => T;
}

export const STORAGE_PREFIX = 'since060815:';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly store: Storage | null = resolveStorage();

  /** True when the browser exposes a working localStorage (false in some private modes). */
  get available(): boolean {
    return this.store !== null;
  }

  read<T>(def: StorageKeyDef<T>): T {
    const raw = this.safeGet(def.key);
    if (raw === null) return def.defaults();

    let envelope: StorageEnvelope<unknown>;
    try {
      envelope = JSON.parse(raw) as StorageEnvelope<unknown>;
    } catch {
      return def.defaults();
    }
    if (!envelope || typeof envelope !== 'object' || typeof envelope.v !== 'number') {
      return def.defaults();
    }

    if (envelope.v === def.version) return envelope.data as T;

    if (def.migrate) {
      const migrated = def.migrate(envelope.data, envelope.v);
      this.write(def, migrated);
      return migrated;
    }
    return def.defaults();
  }

  write<T>(def: StorageKeyDef<T>, value: T): void {
    const envelope: StorageEnvelope<T> = { v: def.version, data: value };
    try {
      this.store?.setItem(STORAGE_PREFIX + def.key, JSON.stringify(envelope));
    } catch {
      // Quota exceeded or storage disabled: preferences simply do not persist.
    }
  }

  remove<T>(def: StorageKeyDef<T>): void {
    try {
      this.store?.removeItem(STORAGE_PREFIX + def.key);
    } catch {
      // ignore
    }
  }

  /** Removes only this app's keys, never the whole origin's storage. */
  clearAll(): void {
    if (!this.store) return;
    const keys: string[] = [];
    for (let i = 0; i < this.store.length; i++) {
      const k = this.store.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => this.store?.removeItem(k));
  }

  private safeGet(key: string): string | null {
    try {
      return this.store?.getItem(STORAGE_PREFIX + key) ?? null;
    } catch {
      return null;
    }
  }
}

function resolveStorage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    const probe = STORAGE_PREFIX + '__probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
