import { describe, expect, it } from 'vitest';
import { confidenceToAlpha, featherBox, finishMask, maskBbox, smoothstepThreshold, temporalBlend, toRgba } from './mask-ops';

describe('mask ops', () => {
  it('smoothstep pushes confident pixels to the extremes and keeps the middle soft', () => {
    const a = new Uint8ClampedArray([0, 40, 128, 220, 255]);
    smoothstepThreshold(a, 0.35, 0.65);
    expect(a[0]).toBe(0);
    expect(a[1]).toBe(0); // below lo
    expect(a[2]).toBeGreaterThan(120); // halfway stays soft
    expect(a[2]).toBeLessThan(136);
    expect(a[3]).toBe(255); // above hi
    expect(a[4]).toBe(255);
  });

  it('temporal blend weighs the previous frame by k and is a no-op on size mismatch', () => {
    const prev = new Uint8ClampedArray([0, 255, 100]);
    const next = new Uint8ClampedArray([255, 255, 100]);
    temporalBlend(prev, next, 0.5);
    expect(Array.from(next)).toEqual([128, 255, 100]);
    const other = new Uint8ClampedArray([9, 9]);
    expect(temporalBlend(prev, other, 0.5)).toBe(other);
    expect(Array.from(other)).toEqual([9, 9]);
  });

  it('box feather preserves flat regions and softens a hard edge symmetrically', () => {
    const width = 8;
    const height = 1;
    const a = new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]);
    featherBox(a, width, height, 1);
    expect(a[0]).toBe(0);
    expect(a[7]).toBe(255);
    expect(a[3]).toBe(85);
    expect(a[4]).toBe(170);
    // Sum is preserved apart from edge replication.
    const flat = new Uint8ClampedArray(16).fill(200);
    featherBox(flat, 4, 4, 1);
    expect(Array.from(flat).every((v) => v === 200)).toBe(true);
  });

  it('bbox finds the covered rectangle in fractions and null for an empty mask', () => {
    const width = 10;
    const height = 10;
    const a = new Uint8ClampedArray(width * height);
    for (let y = 2; y < 6; y++) for (let x = 4; x < 8; x++) a[y * width + x] = 255;
    const box = maskBbox(a, width, height, 128, 1);
    expect(box).toEqual({ x: 0.4, y: 0.2, width: 0.4, height: 0.4 });
    expect(maskBbox(new Uint8ClampedArray(4), 2, 2)).toBeNull();
  });

  it('converts float confidences to bytes and packs alpha into RGBA', () => {
    const alpha = confidenceToAlpha(new Float32Array([0, 0.5, 1]));
    expect(Array.from(alpha)).toEqual([0, 128, 255]);
    const rgba = toRgba({ width: 3, height: 1, alpha, bbox: null });
    expect(Array.from(rgba)).toEqual([255, 255, 255, 0, 255, 255, 255, 128, 255, 255, 255, 255]);
  });

  it('finishMask returns a complete mask with a bbox', () => {
    const width = 6;
    const height = 6;
    const alpha = new Uint8ClampedArray(width * height);
    for (let y = 1; y < 5; y++) for (let x = 1; x < 5; x++) alpha[y * width + x] = 255;
    const mask = finishMask(alpha, width, height, { feather: 0 });
    expect(mask.width).toBe(width);
    expect(mask.bbox).not.toBeNull();
    // Sampled every 2 px: first hit at x = 2.
    expect(mask.bbox!.x).toBeCloseTo(2 / 6, 5);
    expect(mask.bbox!.width).toBeCloseTo(4 / 6, 5);
  });
});
