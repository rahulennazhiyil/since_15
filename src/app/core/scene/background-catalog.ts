/**
 * Built-in scenes. Files live in `public/backgrounds/` and are generated from the SVG
 * sources in `scripts/backgrounds/` by `scripts/make-backgrounds.mjs`.
 */
export type BackgroundPack = 'booth' | 'places' | 'nature' | 'studio';

export interface BackgroundDefinition {
  id: string;
  name: string;
  pack: BackgroundPack;
  /** Path relative to the app base. */
  src: string;
  thumb: string;
  /** Rough brightness so UI text over it can pick a colour. */
  tone: 'light' | 'dark';
}

export const NO_BACKGROUND_ID = 'none';
export const CUSTOM_BACKGROUND_PREFIX = 'custom:';

const def = (id: string, name: string, pack: BackgroundPack, tone: 'light' | 'dark'): BackgroundDefinition => ({
  id,
  name,
  pack,
  src: `backgrounds/${id}.jpg`,
  thumb: `backgrounds/thumbs/${id}.jpg`,
  tone,
});

export const BUILTIN_BACKGROUNDS: readonly BackgroundDefinition[] = [
  def('curtain', 'Photobooth curtain', 'booth', 'dark'),
  def('neon', 'Neon booth', 'booth', 'dark'),
  def('confetti', 'Confetti', 'booth', 'light'),
  def('polka', 'Polka dots', 'booth', 'light'),
  def('film-set', 'Film set', 'booth', 'dark'),
  def('diner', 'Retro diner', 'booth', 'light'),
  def('lanterns', 'Lantern night', 'booth', 'dark'),
  def('beach-dusk', 'Beach at dusk', 'places', 'dark'),
  def('cabin', 'Cabin window', 'places', 'light'),
  def('rooftop', 'City rooftop', 'places', 'dark'),
  def('library', 'Library', 'places', 'dark'),
  def('sakura', 'Cherry blossom', 'nature', 'light'),
  def('garden', 'Garden', 'nature', 'light'),
  def('aurora', 'Northern lights', 'nature', 'dark'),
  def('snow', 'First snow', 'nature', 'light'),
  def('studio-blush', 'Blush studio', 'studio', 'light'),
  def('studio-sage', 'Sage studio', 'studio', 'light'),
  def('studio-night', 'Night studio', 'studio', 'dark'),
];

export const BACKGROUND_PACKS: Record<BackgroundPack, string> = {
  booth: 'Booth',
  places: 'Places',
  nature: 'Nature',
  studio: 'Studio',
};

export function findBackground(id: string): BackgroundDefinition | undefined {
  return BUILTIN_BACKGROUNDS.find((b) => b.id === id);
}

export function isCustomBackgroundId(id: string): boolean {
  return id.startsWith(CUSTOM_BACKGROUND_PREFIX);
}
