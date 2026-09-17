import { maskBbox } from './mask-ops';
import type { Mask, PersonSegmenter } from './segmenter';

/**
 * Deterministic stand-in for tests and development: a soft ellipse where a person would
 * usually be (head and shoulders, slightly below centre). Ignores the source pixels.
 */
export class FakeSegmenter implements PersonSegmenter {
  readonly kind = 'fake' as const;
  private disposed = false;

  segment(_source: CanvasImageSource, width: number, height: number): Promise<Mask> {
    if (this.disposed) return Promise.reject(new Error('disposed'));
    if (width <= 0 || height <= 0) return Promise.reject(new Error('empty probe'));
    return Promise.resolve(ellipseMask(width, height));
  }

  dispose(): void {
    this.disposed = true;
  }
}

export function ellipseMask(width: number, height: number): Mask {
  const alpha = new Uint8ClampedArray(width * height);
  const cx = width * 0.5;
  const cy = height * 0.55;
  const rx = width * 0.28;
  const ry = height * 0.42;
  const edge = 0.12; // soft band, as a fraction of the normalised radius
  for (let y = 0; y < height; y++) {
    const dy = (y + 0.5 - cy) / ry;
    for (let x = 0; x < width; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const d = Math.sqrt(dx * dx + dy * dy);
      const t = d <= 1 - edge ? 1 : d >= 1 ? 0 : (1 - d) / edge;
      alpha[y * width + x] = Math.round(t * 255);
    }
  }
  return { width, height, alpha, bbox: maskBbox(alpha, width, height) };
}
