import type { AnyCanvas } from '../../photo/image-encode';
import { clamp01, type BlendLayer, type Ctx } from './types';

/**
 * Soft bloom. Canvas: a blurred copy of the image screened over itself. Preview: a
 * half-transparent blurred backdrop layer, which reads as the same haze.
 */
export function glowLayer(amount: number): BlendLayer {
  const a = clamp01(amount);
  return {
    background: 'rgb(255 255 255 / 0.04)',
    blend: 'source-over',
    opacity: a * 0.55,
    backdropFilter: `blur(${(4 + a * 8).toFixed(1)}px) brightness(1.05)`,
  };
}

export function drawGlow(ctx: Ctx, canvas: AnyCanvas, width: number, height: number, amount: number, filterSupported: boolean): void {
  if (amount <= 0 || !filterSupported) return;
  const a = clamp01(amount);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = a * 0.55;
  ctx.filter = `blur(${Math.round(4 + a * 8 + width / 320)}px) brightness(1.05)`;
  ctx.drawImage(canvas, 0, 0, width, height);
  ctx.restore();
}
