import type { AnyCanvas } from '../../photo/image-encode';
import { clamp01, type Ctx } from './types';

/** Ghosted colour fringe plus scanlines. */
export function drawVhs(ctx: Ctx, canvas: AnyCanvas, width: number, height: number, amount: number): void {
  if (amount <= 0) return;
  const a = clamp01(amount);
  const shift = Math.max(1, Math.round(width * 0.004 * (0.5 + a)));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.28 * a;
  ctx.drawImage(canvas, shift, 0, width, height);
  ctx.restore();

  const line = 3;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.35 * a;
  ctx.fillStyle = 'rgb(20 20 30)';
  for (let y = 0; y < height; y += line) ctx.fillRect(0, y, width, 1);
  ctx.restore();
}
