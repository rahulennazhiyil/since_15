import type { Adjustments } from '../filter.model';
import { clamp01, type BlendLayer, type Ctx } from './types';

/**
 * Temperature, tint, shadows and highlights are expressed as solid blend layers so the
 * CSS preview (mix-blend-mode) and the canvas render (globalCompositeOperation) agree.
 */
export function toneLayers(a: Adjustments): BlendLayer[] {
  const layers: BlendLayer[] = [];

  if (a.temperature > 0) {
    layers.push({ background: 'rgb(255 160 70)', blend: 'soft-light', opacity: clamp01(a.temperature) * 0.55 });
  } else if (a.temperature < 0) {
    layers.push({ background: 'rgb(70 140 255)', blend: 'soft-light', opacity: clamp01(-a.temperature) * 0.55 });
  }

  if (a.tint > 0) {
    layers.push({ background: 'rgb(255 90 220)', blend: 'soft-light', opacity: clamp01(a.tint) * 0.4 });
  } else if (a.tint < 0) {
    layers.push({ background: 'rgb(90 230 120)', blend: 'soft-light', opacity: clamp01(-a.tint) * 0.4 });
  }

  if (a.shadows > 0) {
    // Screening with grey raises dark pixels far more than bright ones.
    const k = Math.round(clamp01(a.shadows) * 70);
    layers.push({ background: `rgb(${k} ${k} ${k})`, blend: 'screen', opacity: 1 });
  }

  if (a.highlights > 0) {
    // Multiplying by light grey pulls bright pixels down more than dark ones.
    const k = Math.round(255 - clamp01(a.highlights) * 60);
    layers.push({ background: `rgb(${k} ${k} ${k})`, blend: 'multiply', opacity: 1 });
  }

  return layers;
}

export function drawSolidLayer(ctx: Ctx, width: number, height: number, layer: BlendLayer): void {
  ctx.save();
  ctx.globalCompositeOperation = layer.blend;
  ctx.globalAlpha = layer.opacity;
  ctx.fillStyle = layer.background;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
