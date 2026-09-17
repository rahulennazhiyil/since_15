import { AppError } from '../errors/app-error';

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type ImageMime = 'image/jpeg' | 'image/webp' | 'image/png';

export interface Size {
  width: number;
  height: number;
}

/** Scales a size down (never up) so its longer edge fits within maxLongEdge. */
export function fitWithin(width: number, height: number, maxLongEdge: number): Size {
  const long = Math.max(width, height);
  if (!Number.isFinite(maxLongEdge) || long <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function canvasToBlob(canvas: AnyCanvas, type: ImageMime = 'image/jpeg', quality = 0.92): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AppError('photo-failed', { detail: 'toBlob returned null' }))),
      type,
      quality,
    );
  });
}

/** e.g. since060815-20260915-183012.jpg */
export function photoFileName(date: Date, extension = 'jpg'): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `since060815-${stamp}.${extension}`;
}
