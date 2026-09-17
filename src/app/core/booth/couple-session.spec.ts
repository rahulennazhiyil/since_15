import { describe, expect, it } from 'vitest';
import type { CaptureSchedule } from './capture-coordinator';
import { pairLayoutFor, shotTimes, togetherLayoutFor } from './couple-session';

const base: CaptureSchedule = {
  captureId: 'c',
  fireAt: 100_000,
  shots: 3,
  intervalMs: 3000,
  countdownMs: 0,
  mode: 'strip3',
  filterId: 'original',
  layoutId: 'pairSideBySide',
  together: false,
  scene: null,
};

describe('shotTimes', () => {
  it('converts the host fire time and spaces shots by the interval', () => {
    // Guest clock is 250 ms behind the host: host 100000 == local 99750.
    expect(shotTimes(base, (t) => t - 250)).toEqual([99_750, 102_750, 105_750]);
  });

  it('is a single instant for one shot', () => {
    expect(shotTimes({ ...base, shots: 1 }, (t) => t)).toEqual([100_000]);
  });
});

describe('pairLayoutFor', () => {
  it('uses paired strips for multi-shot modes and the chosen layout otherwise', () => {
    expect(pairLayoutFor('strip3', 'pairHeart')).toBe('pairStrip3');
    expect(pairLayoutFor('strip4', 'pairHeart')).toBe('pairStrip4');
    expect(pairLayoutFor('burst', 'pairHeart')).toBe('pairStrip4');
    expect(pairLayoutFor('single', 'pairHeart')).toBe('pairHeart');
  });
});

describe('togetherLayoutFor', () => {
  it('wraps several scenes for strips and bursts and keeps single-image frames otherwise', () => {
    expect(togetherLayoutFor('strip3', 'polaroid')).toBe('strip3');
    expect(togetherLayoutFor('strip4', 'polaroid')).toBe('strip4');
    expect(togetherLayoutFor('burst', 'polaroid')).toBe('grid4');
    expect(togetherLayoutFor('single', 'heart')).toBe('heart');
    // A classic two-tile layout cannot hold one scene: fall back to the plain frame.
    expect(togetherLayoutFor('single', 'pairHeart')).toBe('single');
  });
});
