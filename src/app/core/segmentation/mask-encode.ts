import { canvasToBlob, createCanvas } from '../photo/image-encode';
import { toImageData } from './mask-ops';
import type { Mask } from './segmenter';

/**
 * Masks travel between the two devices as PNGs with the mask in the alpha channel.
 * PNG alpha is lossless, so both sides decode exactly the same bytes.
 */
export async function encodeMaskPng(mask: Mask): Promise<Blob> {
  const canvas = createCanvas(mask.width, mask.height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('no 2d context');
  ctx.putImageData(toImageData(mask), 0, 0);
  return canvasToBlob(canvas, 'image/png');
}

/** Decodes a mask PNG into something drawImage can use with `destination-in`. */
export function decodeMask(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/** Draws a mask onto a fresh canvas the size of the mask (for the live stage). */
export function maskToCanvas(mask: Mask, target?: HTMLCanvasElement | OffscreenCanvas): HTMLCanvasElement | OffscreenCanvas {
  const canvas = target ?? createCanvas(mask.width, mask.height);
  if (canvas.width !== mask.width) canvas.width = mask.width;
  if (canvas.height !== mask.height) canvas.height = mask.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('no 2d context');
  ctx.putImageData(toImageData(mask), 0, 0);
  return canvas;
}
