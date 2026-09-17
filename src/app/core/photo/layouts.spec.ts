import { describe, expect, it } from 'vitest';
import { LAYOUTS, PAIR_LAYOUT_CHOICES, coverCrop, type Rect } from './layouts';

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe('coverCrop', () => {
  it('crops the sides of a wider source', () => {
    expect(coverCrop(1600, 900, 400, 300)).toEqual({ x: 200, y: 0, width: 1200, height: 900 });
  });

  it('crops the top and bottom of a taller source', () => {
    expect(coverCrop(900, 1600, 400, 300)).toEqual({ x: 0, y: 463, width: 900, height: 675 });
  });

  it('returns the full source when aspects match', () => {
    expect(coverCrop(1280, 960, 640, 480)).toEqual({ x: 0, y: 0, width: 1280, height: 960 });
  });
});

describe('LAYOUTS', () => {
  const source = { width: 1280, height: 720 };

  it('single uses the source size and one full slot', () => {
    const r = LAYOUTS.single.compute(source);
    expect(r).toEqual({ width: 1280, height: 720, slots: [{ x: 0, y: 0, width: 1280, height: 720 }] });
  });

  it.each(Object.values(LAYOUTS))('$id has shots x people slots inside the canvas', (layout) => {
    const r = layout.compute(source);
    expect(r.slots).toHaveLength(layout.shots * layout.people);
    for (const s of r.slots) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.x + s.width).toBeLessThanOrEqual(r.width);
      expect(s.y + s.height).toBeLessThanOrEqual(r.height);
    }
    if (r.caption) {
      for (const s of r.slots) expect(overlaps(s, r.caption)).toBe(false);
      expect(r.caption.y + r.caption.height).toBeLessThanOrEqual(r.height);
    }
  });

  it.each(Object.values(LAYOUTS).filter((l) => l.id !== 'pairPip'))('$id slots do not overlap', (layout) => {
    const r = layout.compute(source);
    for (let i = 0; i < r.slots.length; i++) {
      for (let j = i + 1; j < r.slots.length; j++) {
        expect(overlaps(r.slots[i], r.slots[j]), `${i} vs ${j}`).toBe(false);
      }
    }
  });

  it('picture in picture draws the inset first so the big frame paints over nothing', () => {
    const r = LAYOUTS.pairPip.compute(source);
    expect(r.slots[1]).toEqual({ x: 0, y: 0, width: r.width, height: r.height });
    expect(r.slots[0].width).toBeLessThan(r.width / 2);
  });

  it('strips are taller than they are wide', () => {
    for (const id of ['strip3', 'strip4', 'pairStrip3', 'pairStrip4'] as const) {
      const r = LAYOUTS[id].compute(source);
      expect(r.height).toBeGreaterThan(r.width);
    }
  });

  it('heart is square and clipped', () => {
    const r = LAYOUTS.pairHeart.compute(source);
    expect(r.width).toBe(r.height);
    expect(r.clip).toBe('heart');
  });

  it('every pair choice is a two-person single-shot layout', () => {
    for (const id of PAIR_LAYOUT_CHOICES) {
      expect(LAYOUTS[id].people).toBe(2);
      expect(LAYOUTS[id].shots).toBe(1);
    }
  });
});
