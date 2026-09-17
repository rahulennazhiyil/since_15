import type { Mask, NormRect } from './segmenter';

/**
 * Pure mask math on byte arrays. No canvas, no DOM, deterministic integer results so the
 * same input gives the same mask on every device. All functions work in place unless noted.
 */

const SMOOTHSTEP_CACHE = new Map<string, Uint8ClampedArray>();

/** Lookup table mapping 0..255 through a smoothstep between lo and hi (fractions). */
export function smoothstepTable(lo = 0.35, hi = 0.65): Uint8ClampedArray {
  const key = `${lo}:${hi}`;
  const cached = SMOOTHSTEP_CACHE.get(key);
  if (cached) return cached;
  const table = new Uint8ClampedArray(256);
  const span = Math.max(1e-6, hi - lo);
  for (let i = 0; i < 256; i++) {
    const t = Math.min(1, Math.max(0, (i / 255 - lo) / span));
    table[i] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  SMOOTHSTEP_CACHE.set(key, table);
  return table;
}

/** Softly pushes uncertain pixels towards 0 or 255. Kills speckle without hard jaggies. */
export function smoothstepThreshold(alpha: Uint8ClampedArray, lo = 0.35, hi = 0.65): Uint8ClampedArray {
  const table = smoothstepTable(lo, hi);
  for (let i = 0; i < alpha.length; i++) alpha[i] = table[alpha[i]];
  return alpha;
}

/**
 * Exponential moving average with the previous mask: `k` is the weight of the previous
 * frame (0 = no smoothing). Writes into `next`. Sizes must match or `next` is returned as is.
 */
export function temporalBlend(prev: Uint8ClampedArray | null, next: Uint8ClampedArray, k = 0.5): Uint8ClampedArray {
  if (!prev || prev.length !== next.length || k <= 0) return next;
  const kp = Math.round(Math.min(0.95, k) * 256);
  const kn = 256 - kp;
  for (let i = 0; i < next.length; i++) next[i] = (prev[i] * kp + next[i] * kn + 128) >> 8;
  return next;
}

/**
 * Separable box blur (horizontal then vertical), radius in pixels, edges replicated.
 * Integer running sums so the result is identical everywhere.
 */
export function featherBox(alpha: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const r = Math.floor(radius);
  if (r <= 0 || width <= 0 || height <= 0) return alpha;
  const window = 2 * r + 1;
  const tmp = new Uint8ClampedArray(alpha.length);

  // Horizontal pass: alpha -> tmp
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += alpha[row + clampIndex(i, width)];
    for (let x = 0; x < width; x++) {
      tmp[row + x] = Math.round(sum / window);
      sum += alpha[row + clampIndex(x + r + 1, width)] - alpha[row + clampIndex(x - r, width)];
    }
  }
  // Vertical pass: tmp -> alpha
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += tmp[clampIndex(i, height) * width + x];
    for (let y = 0; y < height; y++) {
      alpha[y * width + x] = Math.round(sum / window);
      sum += tmp[clampIndex(y + r + 1, height) * width + x] - tmp[clampIndex(y - r, height) * width + x];
    }
  }
  return alpha;
}

function clampIndex(i: number, n: number): number {
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

/** Bounding box of pixels above `threshold`, sampled every `stride` pixels. Null when empty. */
export function maskBbox(alpha: Uint8ClampedArray, width: number, height: number, threshold = 128, stride = 2): NormRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += stride) {
    const row = y * width;
    for (let x = 0; x < width; x += stride) {
      if (alpha[row + x] >= threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return {
    x: minX / width,
    y: minY / height,
    width: (maxX - minX + stride) / width,
    height: (maxY - minY + stride) / height,
  };
}

/** Converts model confidences (0..1 floats or 0..255 bytes) into mask bytes. */
export function confidenceToAlpha(values: Float32Array | Uint8Array, out?: Uint8ClampedArray): Uint8ClampedArray {
  const alpha = out && out.length === values.length ? out : new Uint8ClampedArray(values.length);
  if (values instanceof Float32Array) {
    for (let i = 0; i < values.length; i++) alpha[i] = values[i] * 255;
  } else {
    alpha.set(values);
  }
  return alpha;
}

/** RGBA bytes with the mask in the alpha channel and white colour, ready for ImageData. */
export function toRgba(mask: Mask): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(new ArrayBuffer(mask.width * mask.height * 4));
  const a = mask.alpha;
  for (let i = 0, j = 0; i < a.length; i++, j += 4) {
    rgba[j] = 255;
    rgba[j + 1] = 255;
    rgba[j + 2] = 255;
    rgba[j + 3] = a[i];
  }
  return rgba;
}

export function toImageData(mask: Mask): ImageData {
  return new ImageData(toRgba(mask), mask.width, mask.height);
}

/** Standard post-processing for a fresh model output. Returns a complete Mask. */
export function finishMask(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  options: { prev?: Uint8ClampedArray | null; temporal?: number; feather?: number } = {},
): Mask {
  smoothstepThreshold(alpha);
  if (options.prev) temporalBlend(options.prev, alpha, options.temporal ?? 0.5);
  if (options.feather) featherBox(alpha, width, height, options.feather);
  return { width, height, alpha, bbox: maskBbox(alpha, width, height) };
}
