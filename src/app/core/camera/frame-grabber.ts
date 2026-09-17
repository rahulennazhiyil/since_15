import { AppError } from '../errors/app-error';
import { createCanvas, fitWithin, type AnyCanvas } from '../photo/image-encode';

export interface GrabOptions {
  mirror: boolean;
  maxLongEdge?: number;
}

/** Horizontal flip expressed as the (a, e) terms of a 2D transform matrix. */
export function mirrorTransform(width: number, mirror: boolean): { a: number; e: number } {
  return mirror ? { a: -1, e: width } : { a: 1, e: 0 };
}

/**
 * Copies the current video frame into a reusable canvas and hands back an ImageBitmap.
 * One instance per camera view; call dispose() when the view goes away.
 */
export class FrameGrabber {
  private canvas: AnyCanvas | null = null;

  async grab(video: HTMLVideoElement, options: GrabOptions): Promise<ImageBitmap> {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) throw new AppError('photo-failed', { detail: 'video has no frame yet' });

    const { width, height } = fitWithin(vw, vh, options.maxLongEdge ?? Number.POSITIVE_INFINITY);
    const canvas = this.ensureCanvas(width, height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new AppError('photo-failed', { detail: 'no 2d context' });

    const { a, e } = mirrorTransform(width, options.mirror);
    ctx.save();
    ctx.setTransform(a, 0, 0, 1, e, 0);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    return createImageBitmap(canvas);
  }

  dispose(): void {
    this.canvas = null;
  }

  private ensureCanvas(width: number, height: number): AnyCanvas {
    if (!this.canvas) this.canvas = createCanvas(width, height);
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    return this.canvas;
  }
}
