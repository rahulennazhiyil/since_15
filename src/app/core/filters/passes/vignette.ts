import { clamp01, type BlendLayer, type Ctx } from './types';

const INNER = 0.45;

export function vignetteLayer(amount: number): BlendLayer {
  const a = clamp01(amount) * 0.85;
  return {
    background: `radial-gradient(ellipse at center, rgb(0 0 0 / 0) ${INNER * 100}%, rgb(0 0 0 / ${a.toFixed(3)}) 100%)`,
    blend: 'multiply',
    opacity: 1,
  };
}

export function drawVignette(ctx: Ctx, width: number, height: number, amount: number): void {
  if (amount <= 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.hypot(cx, cy);
  const gradient = ctx.createRadialGradient(cx, cy, radius * INNER, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${(clamp01(amount) * 0.85).toFixed(3)})`);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
