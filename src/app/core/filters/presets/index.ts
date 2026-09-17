import { createFilter, ORIGINAL_FILTER_ID, type FilterDefinition, type Overlay } from '../filter.model';

const ov = (partial: Omit<Overlay, 'opacity' | 'rotation'> & Partial<Pick<Overlay, 'opacity' | 'rotation'>>): Overlay => ({
  rotation: 0,
  opacity: 1,
  ...partial,
});

/**
 * The built-in collection. Adding a filter is adding an entry; order is display order.
 * Every look here is meant to read clearly at thumbnail size and differ from its
 * neighbours; near-duplicates were folded together on purpose.
 */
export const PRESET_FILTERS: readonly FilterDefinition[] = [
  // Natural ----------------------------------------------------------------
  createFilter({ id: ORIGINAL_FILTER_ID, name: 'Original', category: 'natural' }),
  createFilter({
    id: 'soft',
    name: 'Soft',
    category: 'natural',
    adjustments: { contrast: 0.9, saturation: 0.88, brightness: 1.04, shadows: 0.3, highlights: 0.18, tint: 0.06 },
  }),
  createFilter({
    id: 'warm',
    name: 'Warm',
    category: 'natural',
    adjustments: { temperature: 0.5, saturation: 1.06, brightness: 1.03 },
  }),
  createFilter({
    id: 'cool',
    name: 'Cool',
    category: 'natural',
    adjustments: { temperature: -0.5, saturation: 0.96, contrast: 1.05 },
  }),
  createFilter({
    id: 'bright',
    name: 'Bright',
    category: 'natural',
    adjustments: { exposure: 0.3, contrast: 0.96, saturation: 1.1, shadows: 0.15 },
  }),
  createFilter({
    id: 'fade',
    name: 'Matte',
    category: 'natural',
    adjustments: { fade: 0.7, saturation: 0.8, contrast: 1.02 },
  }),

  // Booth ------------------------------------------------------------------
  createFilter({
    id: 'booth-strip',
    name: 'Booth Strip',
    category: 'booth',
    adjustments: { saturation: 0, contrast: 1.38, brightness: 1.06, shadows: 0.05 },
    effects: { grain: 0.28, vignette: 0.22 },
  }),
  createFilter({
    id: 'korean-booth',
    name: 'Seoul Booth',
    category: 'booth',
    adjustments: { brightness: 1.1, contrast: 0.9, saturation: 0.9, shadows: 0.32, highlights: 0.12, tint: 0.1 },
    effects: { glow: 0.18 },
  }),
  createFilter({
    id: 'disposable',
    name: 'Disposable',
    category: 'booth',
    adjustments: { contrast: 1.15, saturation: 1.12, temperature: 0.22, exposure: 0.18 },
    effects: { grain: 0.42, vignette: 0.38, dateStamp: true },
  }),
  createFilter({
    id: 'instant-print',
    name: 'Instant Print',
    category: 'booth',
    adjustments: { fade: 0.32, sepia: 0.12, temperature: 0.22, contrast: 1.05, saturation: 0.92, highlights: 0.15 },
    effects: { vignette: 0.32, grain: 0.2, lightLeak: 0.12 },
  }),

  // Vintage ----------------------------------------------------------------
  createFilter({
    id: 'film',
    name: 'Film',
    category: 'vintage',
    adjustments: { contrast: 1.1, saturation: 0.82, temperature: 0.28, fade: 0.18, shadows: 0.1 },
    effects: { grain: 0.38, vignette: 0.3 },
  }),
  createFilter({
    id: 'retro',
    name: 'Retro',
    category: 'vintage',
    adjustments: { sepia: 0.35, saturation: 1.25, contrast: 1.14, temperature: 0.35, hue: -8 },
    effects: { vignette: 0.4, grain: 0.22 },
  }),
  createFilter({
    id: 'polaroid',
    name: 'Polaroid',
    category: 'vintage',
    adjustments: { fade: 0.38, contrast: 1.05, saturation: 0.9, temperature: 0.15, tint: 0.14, highlights: 0.22 },
    effects: { vignette: 0.2, lightLeak: 0.28 },
  }),
  createFilter({
    id: 'portra',
    name: 'Portrait Film',
    category: 'vintage',
    adjustments: { temperature: 0.22, tint: 0.06, saturation: 0.9, contrast: 0.98, shadows: 0.16, highlights: 0.16 },
    effects: { grain: 0.18 },
  }),
  createFilter({
    id: 'cinestill',
    name: 'Night Film',
    category: 'vintage',
    adjustments: { temperature: -0.12, tint: -0.1, hue: 3, saturation: 1.12, contrast: 1.12, shadows: 0.08 },
    effects: { grain: 0.3, glow: 0.22 },
  }),
  createFilter({
    id: 'slide',
    name: 'Faded Slide',
    category: 'vintage',
    adjustments: { fade: 0.5, saturation: 0.72, temperature: 0.32, hue: -4, contrast: 1.04 },
    effects: { grain: 0.35, vignette: 0.42 },
  }),
  createFilter({
    id: 'old-camera',
    name: 'Old Camera',
    category: 'vintage',
    adjustments: { sepia: 0.5, contrast: 0.9, fade: 0.3, blur: 0.4 },
    effects: { grain: 0.58, vignette: 0.58 },
  }),

  // Golden hour ------------------------------------------------------------
  createFilter({
    id: 'golden',
    name: 'Golden',
    category: 'golden',
    adjustments: { temperature: 0.55, saturation: 1.1, exposure: 0.1, shadows: 0.15 },
    effects: { glow: 0.25, lightLeak: 0.2 },
  }),
  createFilter({
    id: 'late-sun',
    name: 'Late Sun',
    category: 'golden',
    adjustments: { temperature: 0.7, tint: 0.1, contrast: 1.08, saturation: 1.05, exposure: -0.05 },
    effects: { vignette: 0.28 },
  }),
  createFilter({
    id: 'honey',
    name: 'Honey',
    category: 'golden',
    adjustments: { temperature: 0.5, sepia: 0.15, brightness: 1.04, contrast: 0.98, highlights: 0.2 },
    effects: { glow: 0.35 },
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
    adjustments: { fade: 0.4, temperature: -0.25, saturation: 0.78, brightness: 1.04 },
    effects: { glow: 0.3 },
  }),
  createFilter({
    id: 'romance',
    name: 'Romance',
    category: 'dreamy',
    adjustments: { temperature: 0.3, tint: 0.32, saturation: 0.95, contrast: 0.95, shadows: 0.2 },
    effects: { glow: 0.4, vignette: 0.2, lightLeak: 0.15 },
  }),

  // Black & White ----------------------------------------------------------
  createFilter({
    id: 'mono',
    name: 'Mono',
    category: 'mono',
    adjustments: { saturation: 0, contrast: 1.08, fade: 0.08 },
    effects: { grain: 0.2 },
  }),
  createFilter({
    id: 'high-contrast',
    name: 'High Contrast',
    category: 'mono',
    adjustments: { saturation: 0, contrast: 1.5, brightness: 1.02 },
  }),
  createFilter({
    id: 'film-noir',
    name: 'Film Noir',
    category: 'mono',
    adjustments: { saturation: 0, contrast: 1.3, brightness: 0.9 },
    effects: { vignette: 0.72, grain: 0.4 },
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
