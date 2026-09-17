import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import {
  DEFAULT_PROFILE,
  PROFILE_STORAGE,
  THEMES,
  isThemeId,
  type Profile,
  type ThemeId,
} from './profile.model';

/**
 * Owns the local identity and preferences. Persists every change and keeps the
 * document theme attribute in sync so styles react immediately.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly storage = inject(StorageService);
  private readonly document = inject(DOCUMENT);

  private readonly state = signal<Profile>(this.sanitise(this.storage.read(PROFILE_STORAGE)));

  readonly profile = this.state.asReadonly();
  readonly theme = computed(() => this.state().theme);
  readonly hasIdentity = computed(() => this.state().name.trim().length > 0);
  readonly soundEnabled = computed(() => this.state().soundEnabled);

  constructor() {
    effect(() => this.storage.write(PROFILE_STORAGE, this.state()));
    effect(() => this.applyTheme(this.theme()));
  }

  update(patch: Partial<Profile>): void {
    this.state.update((current) => this.sanitise({ ...current, ...patch }));
  }

  setTheme(theme: ThemeId): void {
    this.update({ theme });
  }

  toggleSound(): void {
    this.update({ soundEnabled: !this.state().soundEnabled });
  }

  private applyTheme(theme: ThemeId): void {
    const root = this.document.documentElement;
    root.setAttribute('data-theme', theme);
    const meta = this.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const info = THEMES.find((t) => t.id === theme);
    if (meta && info) meta.content = info.color;
  }

  /** Fills fields added since the value was stored, so new preferences need no migration. */
  private sanitise(profile: Partial<Profile>): Profile {
    const merged: Profile = { ...DEFAULT_PROFILE, ...profile };
    return {
      ...merged,
      name: merged.name.slice(0, 24),
      theme: isThemeId(merged.theme) ? merged.theme : 'soft',
    };
  }
}
