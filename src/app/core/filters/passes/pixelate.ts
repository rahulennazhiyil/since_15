import { createCanvas, type AnyCanvas } from '../../photo/image-encode';
import { clamp01, type Ctx } from './types';

/** Block size in source pixels for a given amount and image size. */
export function pixelBlockSize(amount: number, width: number, height: number): number {
  const shortEdge = Math.min(width, height);
  return Math.max(2, Math.round(shortEdge * (0.008 + clamp01(amount) * 0.05)));
}

export function drawPixelate(ctx: Ctx, canvas: AnyCanvas, width: number, height: number, amount: number): void {
  if (amount <= 0) return;
  const block = pixelBlockSize(amount, width, height);
  const smallW = Math.max(1, Math.round(width / block));
  const smallH = Math.max(1, Math.round(height / block));
  const small = createCanvas(smallW, smallH);
  const sctx = small.getContext('2d') as Ctx;
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(canvas, 0, 0, smallW, smallH);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(small, 0, 0, smallW, smallH, 0, 0, width, height);
  ctx.restore();
}
