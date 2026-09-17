import { describe, expect, it } from 'vitest';
import { previewLayers, toCssFilter } from './filter-engine';
import { NEUTRAL_ADJUSTMENTS, createFilter } from './filter.model';
import { applyColorMatrix, buildColorMatrix, isIdentityMatrix } from './passes/color-matrix';
import { formatDateStamp } from './passes/date-stamp';
import { pixelBlockSize } from './passes/pixelate';

describe('toCssFilter', () => {
  it('is "none" for neutral adjustments', () => {
    expect(toCssFilter(NEUTRAL_ADJUSTMENTS)).toBe('none');
  });

  it('emits functions in a fixed order and only for non-neutral values', () => {
    const css = toCssFilter({ ...NEUTRAL_ADJUSTMENTS, saturation: 0.8, blur: 2, contrast: 1.1, hue: -6, sepia: 0.3 });
    expect(css).toBe('contrast(1.1) saturate(0.8) hue-rotate(-6deg) sepia(0.3) blur(2px)');
  });

  it('folds exposure and fade into brightness and contrast', () => {
    const css = toCssFilter({ ...NEUTRAL_ADJUSTMENTS, exposure: 1 });
    expect(css).toBe('brightness(2)');
    const faded = toCssFilter({ ...NEUTRAL_ADJUSTMENTS, fade: 1 });
    expect(faded).toBe('brightness(1.08) contrast(0.65)');
  });
});

describe('colour matrix fallback', () => {
  it('is the identity for neutral adjustments', () => {
    expect(isIdentityMatrix(buildColorMatrix(NEUTRAL_ADJUSTMENTS))).toBe(true);
  });

  it('brightness scales channels', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    applyColorMatrix(data, buildColorMatrix({ ...NEUTRAL_ADJUSTMENTS, brightness: 1.5 }));
    expect(Array.from(data)).toEqual([150, 150, 150, 255]);
  });

  it('saturation 0 produces grey with luminance weights', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    applyColorMatrix(data, buildColorMatrix({ ...NEUTRAL_ADJUSTMENTS, saturation: 0 }));
    expect(data[0]).toBe(data[1]);
    expect(data[1]).toBe(data[2]);
    expect(data[0]).toBe(Math.round(0.213 * 255));
  });

  it('contrast pivots around mid grey', () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255, 200, 200, 200, 255]);
    applyColorMatrix(data, buildColorMatrix({ ...NEUTRAL_ADJUSTMENTS, contrast: 2 }));
    expect(data[0]).toBeGreaterThanOrEqual(127);
    expect(data[0]).toBeLessThanOrEqual(129);
    expect(data[4]).toBe(255);
  });
});

describe('previewLayers', () => {
  it('is empty for Original', () => {
    expect(previewLayers(createFilter({ id: 'x', name: 'x', category: 'natural' }))).toEqual([]);
  });

  it('orders tone, vignette, glow, leak', () => {
    const layers = previewLayers(
      createFilter({
        id: 'x',
        name: 'x',
        category: 'natural',
        adjustments: { temperature: 0.5 },
        effects: { vignette: 0.5, glow: 0.5, lightLeak: 0.5 },
      }),
    );
    expect(layers.map((l) => l.blend)).toEqual(['soft-light', 'multiply', 'source-over', 'screen']);
    expect(layers[0].opacity).toBeCloseTo(0.275);
  });
});

describe('helpers', () => {
  it('formats the date stamp like a compact camera', () => {
    expect(formatDateStamp(new Date(2026, 8, 15))).toBe("'26 09 15");
  });

  it('pixel block size grows with amount and image size', () => {
    expect(pixelBlockSize(0.35, 1280, 720)).toBeGreaterThan(pixelBlockSize(0.1, 1280, 720));
    expect(pixelBlockSize(0.35, 640, 480)).toBeLessThan(pixelBlockSize(0.35, 1280, 960));
    expect(pixelBlockSize(0, 10, 10)).toBe(2);
  });
});
