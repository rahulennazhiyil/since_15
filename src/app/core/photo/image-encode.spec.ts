import { describe, it, expect } from 'vitest';
import { fitWithin, photoFileName } from './image-encode';

describe('fitWithin', () => {
  it('leaves small images untouched', () => {
    expect(fitWithin(1280, 720, 2048)).toEqual({ width: 1280, height: 720 });
  });

  it('scales landscape images by the long edge', () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it('scales portrait images by the long edge', () => {
    expect(fitWithin(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it('never returns zero dimensions', () => {
    expect(fitWithin(10000, 1, 100)).toEqual({ width: 100, height: 1 });
  });

  it('treats a non-finite limit as unlimited', () => {
    expect(fitWithin(9000, 9000, Number.POSITIVE_INFINITY)).toEqual({ width: 9000, height: 9000 });
  });
});

describe('photoFileName', () => {
  it('formats a sortable timestamp', () => {
    const d = new Date(2026, 8, 15, 18, 30, 12);
    expect(photoFileName(d)).toBe('since060815-20260915-183012.jpg');
    expect(photoFileName(d, 'webp')).toBe('since060815-20260915-183012.webp');
  });
});
