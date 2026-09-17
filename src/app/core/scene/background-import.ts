import { AppError } from '../errors/app-error';
import { canvasToBlob, createCanvas, fitWithin } from '../photo/image-encode';
import { CUSTOM_BACKGROUND_PREFIX } from './background-catalog';

export const BACKGROUND_MAX_EDGE = 1350;
export const BACKGROUND_JPEG_QUALITY = 0.85;

export interface PreparedBackground {
  id: string;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Turns a picked image into the form both devices store: rotated the way the camera
 * meant it, no larger than the scene, JPEG, named by its own bytes so the partner ends up
 * with exactly the same id for exactly the same picture.
 */
export async function prepareBackground(file: Blob): Promise<PreparedBackground> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (error) {
    throw new AppError('photo-failed', { cause: error, detail: 'could not decode background' });
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, BACKGROUND_MAX_EDGE);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new AppError('photo-failed', { detail: 'no 2d context' });
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', BACKGROUND_JPEG_QUALITY);
    return { id: await backgroundIdFor(blob), blob, width, height };
  } finally {
    bitmap.close();
  }
}

/** `custom:` plus the first 16 hex characters of the SHA-256 of the bytes. */
export async function backgroundIdFor(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const hex = Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${CUSTOM_BACKGROUND_PREFIX}${hex}`;
}
