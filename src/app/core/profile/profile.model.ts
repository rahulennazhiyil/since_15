import type { StorageKeyDef } from '../storage/storage.service';

export type ThemeId = 'soft' | 'night' | 'film' | 'dream';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  description: string;
  /** Page background, used for <meta name="theme-color">. */
  color: string;
}

export const THEMES: readonly ThemeInfo[] = [
  { id: 'soft', name: 'Soft', description: 'Cream and muted pink', color: '#fbf7f2' },
  { id: 'night', name: 'Night', description: 'Charcoal and soft purple', color: '#17151c' },
  { id: 'film', name: 'Film', description: 'Warm beige and black', color: '#efe6d8' },
  { id: 'dream', name: 'Dream', description: 'Lavender and white', color: '#f4f1fb' },
];

export const DEFAULT_THEME: ThemeId = 'soft';

/** The "vibe" a person picks next to their name. Deliberately short and calm. */
export const VIBE_EMOJIS: readonly string[] = ['❤️', '😊', '✨', '🌙', '🌸', '🎨'];

export const PROFILE_COLORS: readonly string[] = [
  '#d98a9c',
  '#9d8ae6',
  '#7fb3a6',
  '#e0a86b',
  '#7ea3d9',
  '#c98bd9',
];

export interface Profile {
  name: string;
  emoji: string;
  color: string;
  theme: ThemeId;
  soundEnabled: boolean;
  lastRoomCode: string | null;
  lastFilterId: string | null;
  /** Keep every photo in the local library automatically. */
  autoSavePhotos: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  emoji: VIBE_EMOJIS[0],
  color: PROFILE_COLORS[0],
  theme: DEFAULT_THEME,
  soundEnabled: false,
  lastRoomCode: null,
  lastFilterId: null,
  autoSavePhotos: true,
};

/**
 * Stored under `since060815:profile`. The theme bootstrap script in index.html reads
 * `data.theme` from this envelope, so keep that path stable across versions.
 */
export const PROFILE_STORAGE: StorageKeyDef<Profile> = {
  key: 'profile',
  version: 1,
  defaults: () => ({ ...DEFAULT_PROFILE }),
};

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}
