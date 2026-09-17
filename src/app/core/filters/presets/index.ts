import { createFilter, ORIGINAL_FILTER_ID, type FilterDefinition, type Overlay } from '../filter.model';

const ov = (partial: Omit<Overlay, 'opacity' | 'rotation'> & Partial<Pick<Overlay, 'opacity' | 'rotation'>>): Overlay => ({
  rotation: 0,
  opacity: 1,
  ...partial,
});

/** The built-in collection. Adding a filter is adding an entry; order is display order. */
export const PRESET_FILTERS: readonly FilterDefinition[] = [
  // Natural ----------------------------------------------------------------
  createFilter({ id: ORIGINAL_FILTER_ID, name: 'Original', category: 'natural' }),
  createFilter({
    id: 'soft',
    name: 'Soft',
    category: 'natural',
    adjustments: { contrast: 0.94, saturation: 0.92, shadows: 0.2, highlights: 0.15 },
  }),
  createFilter({
    id: 'warm',
    name: 'Warm',
    category: 'natural',
    adjustments: { temperature: 0.45, saturation: 1.05, brightness: 1.03 },
  }),
  createFilter({
    id: 'cool',
    name: 'Cool',
    category: 'natural',
    adjustments: { temperature: -0.45, saturation: 0.98, contrast: 1.03 },
  }),
  createFilter({
    id: 'bright',
    name: 'Bright',
    category: 'natural',
    adjustments: { exposure: 0.25, contrast: 0.97, saturation: 1.08, shadows: 0.15 },
  }),
  createFilter({
    id: 'fade',
    name: 'Fade',
    category: 'natural',
    adjustments: { fade: 0.55, saturation: 0.85 },
  }),

  // Vintage ----------------------------------------------------------------
  createFilter({
    id: 'film',
    name: 'Film',
    category: 'vintage',
    adjustments: { contrast: 1.08, saturation: 0.82, temperature: 0.25, fade: 0.2, shadows: 0.1 },
    effects: { grain: 0.35, vignette: 0.3 },
  }),
  createFilter({
    id: 'retro',
    name: 'Retro',
    category: 'vintage',
    adjustments: { sepia: 0.3, saturation: 1.15, contrast: 1.1, temperature: 0.3, hue: -6 },
    effects: { vignette: 0.35, grain: 0.2 },
  }),
  createFilter({
    id: 'polaroid',
    name: 'Polaroid',
    category: 'vintage',
    adjustments: { fade: 0.35, contrast: 1.05, saturation: 0.9, temperature: 0.15, tint: 0.12, highlights: 0.2 },
    effects: { vignette: 0.2, lightLeak: 0.25 },
  }),
  createFilter({
    id: 'old-camera',
    name: 'Old Camera',
    category: 'vintage',
    adjustments: { sepia: 0.45, contrast: 0.9, fade: 0.3, blur: 0.4 },
    effects: { grain: 0.55, vignette: 0.55 },
  }),
  createFilter({
    id: 'dusty',
    name: 'Dusty',
    category: 'vintage',
    adjustments: { fade: 0.45, saturation: 0.7, temperature: 0.35, contrast: 0.95 },
    effects: { grain: 0.7, vignette: 0.25 },
  }),

  // Dreamy -----------------------------------------------------------------
  createFilter({
    id: 'dream',
    name: 'Dream',
    category: 'dreamy',
    adjustments: { brightness: 1.05, contrast: 0.9, saturation: 1.05, tint: 0.15, shadows: 0.25 },
    effects: { glow: 0.6 },
  }),
  createFilter({
    id: 'soft-glow',
    name: 'Soft Glow',
    category: 'dreamy',
    adjustments: { brightness: 1.04, contrast: 0.95, highlights: 0.1 },
    effects: { glow: 0.85 },
  }),
  createFilter({
    id: 'cloudy',
    name: 'Cloudy',
    category: 'dreamy',
    adjustments: { fade: 0.4, temperature: -0.2, saturation: 0.8, brightness: 1.04 },
    effects: { glow: 0.3 },
  }),
  createFilter({
    id: 'pastel',
    name: 'Pastel',
    category: 'dreamy',
    adjustments: { saturation: 0.75, brightness: 1.08, contrast: 0.85, tint: 0.2, shadows: 0.35 },
  }),
  createFilter({
    id: 'romance',
    name: 'Romance',
    category: 'dreamy',
    adjustments: { temperature: 0.3, tint: 0.3, saturation: 0.95, contrast: 0.95, shadows: 0.2 },
    effects: { glow: 0.4, vignette: 0.2, lightLeak: 0.15 },
  }),

  // Black & White ----------------------------------------------------------
  createFilter({
    id: 'mono',
    name: 'Mono',
    category: 'mono',
    adjustments: { saturation: 0, contrast: 1.05 },
  }),
  createFilter({
    id: 'classic',
    name: 'Classic',
    category: 'mono',
    adjustments: { saturation: 0, contrast: 1.12, fade: 0.1, shadows: 0.1 },
    effects: { grain: 0.3, vignette: 0.25 },
  }),
  createFilter({
    id: 'high-contrast',
    name: 'High Contrast',
    category: 'mono',
    adjustments: { saturation: 0, contrast: 1.45, brightness: 1.02 },
  }),
  createFilter({
    id: 'film-noir',
    name: 'Film Noir',
    category: 'mono',
    adjustments: { saturation: 0, contrast: 1.3, brightness: 0.92 },
    effects: { vignette: 0.7, grain: 0.4 },
  }),

  // Fun --------------------------------------------------------------------
  createFilter({
    id: 'vhs',
    name: 'VHS',
    category: 'fun',
    adjustments: { saturation: 1.2, contrast: 1.05, hue: 4, fade: 0.1 },
    effects: { vhs: 0.8, grain: 0.3 },
  }),
  createFilter({
    id: 'pixel',
    name: 'Pixel',
    category: 'fun',
    adjustments: { saturation: 1.15, contrast: 1.1 },
    effects: { pixelate: 0.35 },
  }),
  createFilter({
    id: 'disposable',
    name: 'Disposable',
    category: 'fun',
    adjustments: { contrast: 1.12, saturation: 1.1, temperature: 0.2, exposure: 0.1 },
    effects: { grain: 0.4, vignette: 0.3, dateStamp: true },
  }),
  createFilter({
    id: 'flash',
    name: 'Flash',
    category: 'fun',
    adjustments: { exposure: 0.35, contrast: 1.2, saturation: 1.05, highlights: 0.05 },
    effects: { vignette: 0.45 },
  }),
  createFilter({
    id: 'date-stamp',
    name: 'Date Stamp',
    category: 'fun',
    adjustments: { temperature: 0.1 },
    effects: { dateStamp: true },
  }),

  // Couple -----------------------------------------------------------------
  createFilter({
    id: 'hearts',
    name: 'Hearts',
    category: 'couple',
    adjustments: { temperature: 0.15, saturation: 1.02 },
    overlays: [
      ov({ id: 'h1', kind: 'emoji', content: '❤️', x: 0.9, y: 0.12, scale: 0.09, rotation: 12, opacity: 0.92 }),
      ov({ id: 'h2', kind: 'emoji', content: '❤️', x: 0.82, y: 0.24, scale: 0.05, rotation: -8, opacity: 0.8 }),
      ov({ id: 'h3', kind: 'emoji', content: '❤️', x: 0.1, y: 0.86, scale: 0.06, rotation: -14, opacity: 0.85 }),
    ],
  }),
  createFilter({
    id: 'tiny-sparkles',
    name: 'Tiny Sparkles',
    category: 'couple',
    adjustments: { brightness: 1.03, contrast: 0.97 },
    effects: { glow: 0.25 },
    overlays: [
      ov({ id: 's1', kind: 'emoji', content: '✨', x: 0.12, y: 0.14, scale: 0.07, opacity: 0.9 }),
      ov({ id: 's2', kind: 'emoji', content: '✨', x: 0.88, y: 0.2, scale: 0.05, opacity: 0.8 }),
      ov({ id: 's3', kind: 'emoji', content: '✨', x: 0.8, y: 0.84, scale: 0.06, opacity: 0.85 }),
      ov({ id: 's4', kind: 'emoji', content: '✨', x: 0.18, y: 0.8, scale: 0.04, opacity: 0.7 }),
    ],
  }),
  createFilter({
    id: 'together',
    name: 'Together',
    category: 'couple',
    adjustments: { temperature: 0.15, fade: 0.1 },
    effects: { vignette: 0.15 },
    overlays: [
      ov({ id: 't1', kind: 'text', content: 'together', font: 'display', x: 0.5, y: 0.88, scale: 0.12, color: '#ffffff', opacity: 0.95 }),
    ],
  }),
  createFilter({
    id: 'miss-you',
    name: 'Miss You',
    category: 'couple',
    adjustments: { temperature: -0.1, tint: 0.1, fade: 0.2, saturation: 0.9 },
    effects: { glow: 0.2 },
    overlays: [
      ov({ id: 'm1', kind: 'text', content: 'miss you', font: 'display', x: 0.5, y: 0.14, scale: 0.11, color: '#ffffff', opacity: 0.95 }),
    ],
  }),
  createFilter({
    id: 'made-with-love',
    name: 'Made With Love',
    category: 'couple',
    adjustments: { temperature: 0.2, saturation: 1.02 },
    overlays: [
      ov({ id: 'l1', kind: 'text', content: 'made with love', font: 'display', x: 0.5, y: 0.9, scale: 0.09, color: '#ffffff', opacity: 0.92 }),
      ov({ id: 'l2', kind: 'shape', content: 'heart', x: 0.9, y: 0.1, scale: 0.08, color: '#e88aa0', opacity: 0.9, rotation: 10 }),
    ],
  }),
  createFilter({
    id: 'stars',
    name: 'Stars',
    category: 'couple',
    adjustments: { contrast: 1.04, temperature: -0.05 },
    effects: { vignette: 0.25 },
    overlays: [
      ov({ id: 'st1', kind: 'shape', content: 'star', x: 0.1, y: 0.12, scale: 0.07, color: '#fff3c4', opacity: 0.95, rotation: -10 }),
      ov({ id: 'st2', kind: 'shape', content: 'star', x: 0.18, y: 0.26, scale: 0.035, color: '#fff3c4', opacity: 0.8, rotation: 15 }),
      ov({ id: 'st3', kind: 'shape', content: 'star', x: 0.9, y: 0.16, scale: 0.05, color: '#fff3c4', opacity: 0.9, rotation: 20 }),
      ov({ id: 'st4', kind: 'shape', content: 'star', x: 0.86, y: 0.82, scale: 0.06, color: '#fff3c4', opacity: 0.85, rotation: -20 }),
    ],
  }),
];

export const ORIGINAL_FILTER: FilterDefinition = PRESET_FILTERS[0];
