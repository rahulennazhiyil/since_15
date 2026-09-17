import { clamp01, type BlendLayer, type Ctx } from './types';

export function lightLeakLayer(amount: number): BlendLayer {
  return {
    background:
      'linear-gradient(215deg, rgb(255 120 90) 0%, rgb(255 170 60 / 0.6) 22%, rgb(255 255 255 / 0) 55%)',
    blend: 'screen',
    opacity: clamp01(amount) * 0.75,
  };
}

export function drawLightLeak(ctx: Ctx, width: number, height: number, amount: number): void {
  if (amount <= 0) return;
  // Top-right corner towards bottom-left, matching the CSS 215deg gradient direction.
  const gradient = ctx.createLinearGradient(width, 0, width * 0.3, height);
  gradient.addColorStop(0, 'rgb(255,120,90)');
  gradient.addColorStop(0.22, 'rgba(255,170,60,0.6)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = clamp01(amount) * 0.75;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
