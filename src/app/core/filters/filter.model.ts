export type FilterCategory = 'natural' | 'vintage' | 'dreamy' | 'mono' | 'fun' | 'couple' | 'custom';

export const FILTER_CATEGORIES: readonly { id: FilterCategory; name: string }[] = [
  { id: 'natural', name: 'Natural' },
  { id: 'vintage', name: 'Vintage' },
  { id: 'dreamy', name: 'Dreamy' },
  { id: 'mono', name: 'Black & White' },
  { id: 'fun', name: 'Fun' },
  { id: 'couple', name: 'Couple' },
  { id: 'custom', name: 'Mine' },
];

/**
 * Colour and tone controls. Every field has a neutral value at which it does nothing, so
 * a filter made only of neutral values is identical to Original.
 */
export interface Adjustments {
  /** 1 = neutral. 0..2 */
  brightness: number;
  /** 1 = neutral. 0..2 */
  contrast: number;
  /** 1 = neutral. 0..2 */
  saturation: number;
  /** 0 = neutral, in stops. -1..1 */
  exposure: number;
  /** 0 = neutral. -1 cool .. 1 warm */
  temperature: number;
  /** 0 = neutral. -1 green .. 1 magenta */
  tint: number;
  /** 0 = neutral, degrees. -180..180 */
  hue: number;
  /** 0 = neutral. 0..1 lifts shadows */
  shadows: number;
  /** 0 = neutral. 0..1 softens highlights */
  highlights: number;
  /** 0 = neutral. 0..1 */
  sepia: number;
  /** 0 = neutral, px. 0..8 */
  blur: number;
  /** 0 = neutral. 0..1 */
  sharpen: number;
  /** 0 = neutral. 0..1 washed, lifted blacks */
  fade: number;
}

export interface Effects {
  /** 0..1 */
  grain: number;
  /** 0..1 */
  vignette: number;
  /** 0..1 soft bloom */
  glow: number;
  /** 0..1 warm corner leak */
  lightLeak: number;
  /** 0 off .. 1 large blocks */
  pixelate: number;
  /** 0..1 ghosting and scanlines */
  vhs: number;
  dateStamp: boolean;
}

export type OverlayKind = 'emoji' | 'text' | 'shape';
export type OverlayShape = 'heart' | 'star' | 'circle';

export interface Overlay {
  id: string;
  kind: OverlayKind;
  /** Emoji characters, text, or a shape name. */
  content: string;
  /** Centre position as a fraction of width / height. 0..1 */
  x: number;
  y: number;
  /** Size as a fraction of the shorter image edge. 0.02..0.6 */
  scale: number;
  /** Degrees */
  rotation: number;
  /** 0..1 */
  opacity: number;
  /** Text and shapes only. */
  color?: string;
  /** Text only. */
  font?: 'ui' | 'display';
}

export interface FilterDefinition {
  id: string;
  name: string;
  category: FilterCategory;
  adjustments: Adjustments;
  effects: Effects;
  overlays: Overlay[];
  isCustom: boolean;
  createdAt?: number;
}

export const NEUTRAL_ADJUSTMENTS: Readonly<Adjustments> = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  exposure: 0,
  temperature: 0,
  tint: 0,
  hue: 0,
  shadows: 0,
  highlights: 0,
  sepia: 0,
  blur: 0,
  sharpen: 0,
  fade: 0,
};

export const NEUTRAL_EFFECTS: Readonly<Effects> = {
  grain: 0,
  vignette: 0,
  glow: 0,
  lightLeak: 0,
  pixelate: 0,
  vhs: 0,
  dateStamp: false,
};

export interface FilterDraft {
  id: string;
  name: string;
  category: FilterCategory;
  adjustments?: Partial<Adjustments>;
  effects?: Partial<Effects>;
  overlays?: Overlay[];
  isCustom?: boolean;
  createdAt?: number;
}

export function createFilter(draft: FilterDraft): FilterDefinition {
  return {
    id: draft.id,
    name: draft.name,
    category: draft.category,
    adjustments: { ...NEUTRAL_ADJUSTMENTS, ...draft.adjustments },
    effects: { ...NEUTRAL_EFFECTS, ...draft.effects },
    overlays: draft.overlays ?? [],
    isCustom: draft.isCustom ?? false,
    createdAt: draft.createdAt,
  };
}

export const ORIGINAL_FILTER_ID = 'original';

export function isNeutralAdjustments(a: Adjustments): boolean {
  return (Object.keys(NEUTRAL_ADJUSTMENTS) as (keyof Adjustments)[]).every((k) => a[k] === NEUTRAL_ADJUSTMENTS[k]);
}

export function isNeutralEffects(e: Effects): boolean {
  return (Object.keys(NEUTRAL_EFFECTS) as (keyof Effects)[]).every((k) => e[k] === NEUTRAL_EFFECTS[k]);
}

/** Effects the live CSS preview cannot approximate; the preview falls back to a canvas loop. */
export function needsCanvasPreview(filter: FilterDefinition): boolean {
  return filter.effects.pixelate > 0 || filter.effects.vhs > 0;
}
