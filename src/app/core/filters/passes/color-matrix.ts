import type { Adjustments } from '../filter.model';

/** Row-major 4x5 colour matrix (RGBA in, RGBA out, last column is offset in 0..1 units). */
export type ColorMatrix = number[];

const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

function multiply(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  // result = a * b  (apply b first, then a)
  const out: ColorMatrix = new Array(20).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[r * 5 + k] * b[k * 5 + c];
      if (c === 4) v += a[r * 5 + 4];
      out[r * 5 + c] = v;
    }
  }
  return out;
}

function scale(rgb: number, offset: number): ColorMatrix {
  return [rgb, 0, 0, 0, offset, 0, rgb, 0, 0, offset, 0, 0, rgb, 0, offset, 0, 0, 0, 1, 0];
}

function saturate(s: number): ColorMatrix {
  const r = 0.213, g = 0.715, b = 0.072;
  return [
    r + (1 - r) * s, g - g * s, b - b * s, 0, 0,
    r - r * s, g + (1 - g) * s, b - b * s, 0, 0,
    r - r * s, g - g * s, b + (1 - b) * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function hueRotate(degrees: number): ColorMatrix {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928, 0, 0,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283, 0, 0,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function sepia(amount: number): ColorMatrix {
  const t = amount;
  return [
    0.393 + 0.607 * (1 - t), 0.769 - 0.769 * (1 - t), 0.189 - 0.189 * (1 - t), 0, 0,
    0.349 - 0.349 * (1 - t), 0.686 + 0.314 * (1 - t), 0.168 - 0.168 * (1 - t), 0, 0,
    0.272 - 0.272 * (1 - t), 0.534 - 0.534 * (1 - t), 0.131 + 0.869 * (1 - t), 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** Effective brightness and contrast once exposure and fade are folded in. */
export function effectiveTone(a: Adjustments): { brightness: number; contrast: number } {
  return {
    brightness: a.brightness * Math.pow(2, a.exposure) * (1 + a.fade * 0.08),
    contrast: a.contrast * (1 - a.fade * 0.35),
  };
}

/**
 * Builds the same transform the CSS filter string expresses, in the same order:
 * brightness, contrast, saturate, hue-rotate, sepia. Used when ctx.filter is missing.
 */
export function buildColorMatrix(a: Adjustments): ColorMatrix {
  const { brightness, contrast } = effectiveTone(a);
  let m = IDENTITY;
  m = multiply(scale(brightness, 0), m);
  m = multiply(scale(contrast, (1 - contrast) / 2), m);
  m = multiply(saturate(a.saturation), m);
  if (a.hue !== 0) m = multiply(hueRotate(a.hue), m);
  if (a.sepia > 0) m = multiply(sepia(a.sepia), m);
  return m;
}

export function isIdentityMatrix(m: ColorMatrix, epsilon = 1e-6): boolean {
  return m.every((v, i) => Math.abs(v - IDENTITY[i]) < epsilon);
}

export function applyColorMatrix(data: Uint8ClampedArray, m: ColorMatrix): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    data[i] = (m[0] * r + m[1] * g + m[2] * b + m[4]) * 255;
    data[i + 1] = (m[5] * r + m[6] * g + m[7] * b + m[9]) * 255;
    data[i + 2] = (m[10] * r + m[11] * g + m[12] * b + m[14]) * 255;
  }
}
