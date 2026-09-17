import { describe, it, expect } from 'vitest';
import { mirrorTransform } from './frame-grabber';

describe('mirrorTransform', () => {
  it('is identity when not mirroring', () => {
    expect(mirrorTransform(1280, false)).toEqual({ a: 1, e: 0 });
  });

  it('flips horizontally about the frame width when mirroring', () => {
    expect(mirrorTransform(1280, true)).toEqual({ a: -1, e: 1280 });
  });

  it('maps the left edge to the right edge under the mirror', () => {
    const { a, e } = mirrorTransform(640, true);
    expect(a * 0 + e).toBe(640);
    expect(a * 640 + e).toBe(0);
  });
});
