import { describe, expect, it } from 'vitest';
import { FakeSegmenter, ellipseMask } from './fake-segmenter';

describe('fake segmenter', () => {
  it('draws a soft ellipse with the person below centre', () => {
    const mask = ellipseMask(40, 60);
    const at = (x: number, y: number) => mask.alpha[y * 40 + x];
    expect(at(20, 33)).toBe(255); // centre
    expect(at(1, 1)).toBe(0); // corner
    expect(at(20, 0)).toBe(0); // top edge, above the head
    expect(mask.bbox).not.toBeNull();
    expect(mask.bbox!.width).toBeGreaterThan(0.5);
    expect(mask.bbox!.height).toBeGreaterThan(0.7);
  });

  it('is deterministic and rejects after dispose', async () => {
    const seg = new FakeSegmenter();
    const source = {} as CanvasImageSource;
    const a = await seg.segment(source, 16, 16);
    const b = await seg.segment(source, 16, 16);
    expect(Array.from(a.alpha)).toEqual(Array.from(b.alpha));
    seg.dispose();
    await expect(seg.segment(source, 16, 16)).rejects.toThrow();
  });
});
