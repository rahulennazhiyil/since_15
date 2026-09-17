import { describe, expect, it } from 'vitest';
import { FILTER_CATEGORIES, ORIGINAL_FILTER_ID, isNeutralAdjustments, isNeutralEffects } from '../filter.model';
import { ORIGINAL_FILTER, PRESET_FILTERS } from './index';

describe('PRESET_FILTERS', () => {
  it('starts with Original, which is fully neutral', () => {
    expect(ORIGINAL_FILTER.id).toBe(ORIGINAL_FILTER_ID);
    expect(isNeutralAdjustments(ORIGINAL_FILTER.adjustments)).toBe(true);
    expect(isNeutralEffects(ORIGINAL_FILTER.effects)).toBe(true);
    expect(ORIGINAL_FILTER.overlays).toEqual([]);
  });

  it('has unique ids and names', () => {
    const ids = PRESET_FILTERS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = PRESET_FILTERS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers every non-custom category', () => {
    const present = new Set(PRESET_FILTERS.map((f) => f.category));
    for (const c of FILTER_CATEGORIES.filter((c) => c.id !== 'custom')) {
      expect(present.has(c.id), c.id).toBe(true);
    }
  });

  it('every preset except Original changes something, and no two presets are the same look', () => {
    const looks = new Map<string, string>();
    for (const f of PRESET_FILTERS) {
      const changes = !isNeutralAdjustments(f.adjustments) || !isNeutralEffects(f.effects) || f.overlays.length > 0;
      expect(changes || f.id === ORIGINAL_FILTER_ID, f.id).toBe(true);
      const look = JSON.stringify({ a: f.adjustments, e: f.effects, o: f.overlays });
      expect(looks.get(look), `${f.id} duplicates ${looks.get(look)}`).toBeUndefined();
      looks.set(look, f.id);
    }
  });

  it('keeps the ids the end-to-end tests and old photos rely on', () => {
    const ids = new Set(PRESET_FILTERS.map((f) => f.id));
    for (const id of ['original', 'film', 'pixel', 'hearts', 'mono', 'disposable', 'together']) expect(ids.has(id), id).toBe(true);
  });

  it('is plain JSON and survives a round trip', () => {
    for (const f of PRESET_FILTERS) {
      expect(JSON.parse(JSON.stringify(f))).toEqual(f);
      expect(f.isCustom).toBe(false);
    }
  });

  it('keeps every numeric value inside its documented range', () => {
    for (const f of PRESET_FILTERS) {
      const a = f.adjustments;
      expect(a.brightness).toBeGreaterThanOrEqual(0);
      expect(a.brightness).toBeLessThanOrEqual(2);
      expect(a.contrast).toBeGreaterThanOrEqual(0);
      expect(a.contrast).toBeLessThanOrEqual(2);
      expect(a.saturation).toBeGreaterThanOrEqual(0);
      expect(a.saturation).toBeLessThanOrEqual(2);
      expect(Math.abs(a.temperature)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.tint)).toBeLessThanOrEqual(1);
      for (const k of ['shadows', 'highlights', 'sepia', 'sharpen', 'fade'] as const) {
        expect(a[k], `${f.id}.${k}`).toBeGreaterThanOrEqual(0);
        expect(a[k], `${f.id}.${k}`).toBeLessThanOrEqual(1);
      }
      for (const k of ['grain', 'vignette', 'glow', 'lightLeak', 'pixelate', 'vhs'] as const) {
        expect(f.effects[k], `${f.id}.${k}`).toBeGreaterThanOrEqual(0);
        expect(f.effects[k], `${f.id}.${k}`).toBeLessThanOrEqual(1);
      }
      for (const o of f.overlays) {
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.x).toBeLessThanOrEqual(1);
        expect(o.y).toBeGreaterThanOrEqual(0);
        expect(o.y).toBeLessThanOrEqual(1);
        expect(o.scale).toBeLessThanOrEqual(0.6);
        expect(o.opacity).toBeLessThanOrEqual(1);
      }
    }
  });
});
