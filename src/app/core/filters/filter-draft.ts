import { computed, signal } from '@angular/core';
import { uid } from '../../shared/utils/id';
import {
  NEUTRAL_ADJUSTMENTS,
  NEUTRAL_EFFECTS,
  createFilter,
  type Adjustments,
  type Effects,
  type FilterDefinition,
  type Overlay,
  type OverlayKind,
} from './filter.model';

export const MAX_OVERLAYS = 12;
export const MAX_NAME_LENGTH = 24;

/** Slider ranges for the editor. Single source of truth for min/max/step. */
export const ADJUSTMENT_RANGES: Record<keyof Adjustments, { min: number; max: number; step: number }> = {
  brightness: { min: 0.5, max: 1.5, step: 0.01 },
  contrast: { min: 0.5, max: 1.5, step: 0.01 },
  saturation: { min: 0, max: 2, step: 0.01 },
  exposure: { min: -1, max: 1, step: 0.01 },
  temperature: { min: -1, max: 1, step: 0.01 },
  tint: { min: -1, max: 1, step: 0.01 },
  hue: { min: -180, max: 180, step: 1 },
  shadows: { min: 0, max: 1, step: 0.01 },
  highlights: { min: 0, max: 1, step: 0.01 },
  sepia: { min: 0, max: 1, step: 0.01 },
  blur: { min: 0, max: 8, step: 0.1 },
  sharpen: { min: 0, max: 1, step: 0.01 },
  fade: { min: 0, max: 1, step: 0.01 },
};

export type NumericEffect = Exclude<keyof Effects, 'dateStamp'>;
export const EFFECT_RANGE = { min: 0, max: 1, step: 0.01 };

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Editable, signal-backed working copy of a filter. Pure state: no storage, no DOM.
 * The editor page binds to it; tests drive it directly.
 */
export class FilterDraft {
  readonly id: string;
  readonly name = signal('');
  readonly adjustments = signal<Adjustments>({ ...NEUTRAL_ADJUSTMENTS });
  readonly effects = signal<Effects>({ ...NEUTRAL_EFFECTS });
  readonly overlays = signal<Overlay[]>([]);
  readonly selectedOverlayId = signal<string | null>(null);
  private readonly createdAt: number | undefined;

  readonly selectedOverlay = computed(() => this.overlays().find((o) => o.id === this.selectedOverlayId()) ?? null);
  readonly canAddOverlay = computed(() => this.overlays().length < MAX_OVERLAYS);
  readonly isValid = computed(() => this.name().trim().length > 0);

  /** Live definition for preview and thumbnails. */
  readonly definition = computed<FilterDefinition>(() =>
    createFilter({
      id: this.id,
      name: this.name().trim() || 'My filter',
      category: 'custom',
      adjustments: this.adjustments(),
      effects: this.effects(),
      overlays: this.overlays(),
      isCustom: true,
      createdAt: this.createdAt,
    }),
  );

  constructor(source?: FilterDefinition) {
    this.id = source?.id ?? uid('filter');
    this.createdAt = source?.createdAt;
    if (source) {
      this.name.set(source.name);
      this.adjustments.set({ ...source.adjustments });
      this.effects.set({ ...source.effects });
      this.overlays.set(source.overlays.map((o) => ({ ...o })));
    }
  }

  setName(name: string): void {
    this.name.set(name.slice(0, MAX_NAME_LENGTH));
  }

  setAdjustment(key: keyof Adjustments, value: number): void {
    const { min, max } = ADJUSTMENT_RANGES[key];
    this.adjustments.update((a) => ({ ...a, [key]: clamp(value, min, max) }));
  }

  setEffect(key: NumericEffect, value: number): void {
    this.effects.update((e) => ({ ...e, [key]: clamp(value, 0, 1) }));
  }

  setDateStamp(on: boolean): void {
    this.effects.update((e) => ({ ...e, dateStamp: on }));
  }

  resetAdjustments(): void {
    this.adjustments.set({ ...NEUTRAL_ADJUSTMENTS });
  }

  resetEffects(): void {
    this.effects.set({ ...NEUTRAL_EFFECTS });
  }

  addOverlay(kind: OverlayKind, content: string, extra: Partial<Overlay> = {}): Overlay | null {
    if (!this.canAddOverlay()) return null;
    const overlay: Overlay = {
      id: uid('ov'),
      kind,
      content,
      x: 0.5,
      y: 0.5,
      scale: kind === 'text' ? 0.1 : 0.14,
      rotation: 0,
      opacity: 1,
      color: kind === 'emoji' ? undefined : '#ffffff',
      font: kind === 'text' ? 'display' : undefined,
      ...extra,
    };
    this.overlays.update((list) => [...list, overlay]);
    this.selectedOverlayId.set(overlay.id);
    return overlay;
  }

  updateOverlay(id: string, patch: Partial<Omit<Overlay, 'id' | 'kind'>>): void {
    this.overlays.update((list) =>
      list.map((o) => {
        if (o.id !== id) return o;
        const next = { ...o, ...patch };
        return {
          ...next,
          x: clamp(next.x, 0, 1),
          y: clamp(next.y, 0, 1),
          scale: clamp(next.scale, 0.02, 0.6),
          opacity: clamp(next.opacity, 0, 1),
          rotation: ((next.rotation % 360) + 360) % 360,
        };
      }),
    );
  }

  /** Moves an overlay by a delta expressed in fractions of the preview size. */
  nudgeOverlay(id: string, dx: number, dy: number): void {
    const o = this.overlays().find((item) => item.id === id);
    if (o) this.updateOverlay(id, { x: o.x + dx, y: o.y + dy });
  }

  removeOverlay(id: string): void {
    this.overlays.update((list) => list.filter((o) => o.id !== id));
    if (this.selectedOverlayId() === id) this.selectedOverlayId.set(null);
  }

  select(id: string | null): void {
    this.selectedOverlayId.set(id);
  }
}
