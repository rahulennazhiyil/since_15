import { Injectable } from '@angular/core';
import { detectBrowserSupport } from '../permissions/browser-support';
import { createCanvas, type AnyCanvas } from '../photo/image-encode';
import { isNeutralAdjustments, type Adjustments, type FilterDefinition } from './filter.model';
import { drawOverlays } from './overlay-renderer';
import { applyColorMatrix, buildColorMatrix, effectiveTone, isIdentityMatrix } from './passes/color-matrix';
import { drawDateStamp } from './passes/date-stamp';
import { drawGlow, glowLayer } from './passes/glow';
import { drawGrain, grainLayer } from './passes/grain';
import { drawLightLeak, lightLeakLayer } from './passes/light-leak';
import { drawPixelate } from './passes/pixelate';
import { drawSharpen } from './passes/sharpen';
import { drawSolidLayer, toneLayers } from './passes/tone-layers';
import type { BlendLayer, Ctx } from './passes/types';
import { drawVhs } from './passes/vhs';
import { drawVignette, vignetteLayer } from './passes/vignette';

export interface PreviewStyle {
  /** Value for the video element's CSS `filter`. */
  filter: string;
  /** Layers to stack above the video, in order. */
  layers: BlendLayer[];
}

/** The part of Adjustments that CSS `filter` expresses directly. */
export function toCssFilter(a: Adjustments): string {
  const { brightness, contrast } = effectiveTone(a);
  const parts: string[] = [];
  if (Math.abs(brightness - 1) > 1e-3) parts.push(`brightness(${round(brightness)})`);
  if (Math.abs(contrast - 1) > 1e-3) parts.push(`contrast(${round(contrast)})`);
  if (Math.abs(a.saturation - 1) > 1e-3) parts.push(`saturate(${round(a.saturation)})`);
  if (a.hue !== 0) parts.push(`hue-rotate(${round(a.hue)}deg)`);
  if (a.sepia > 0) parts.push(`sepia(${round(a.sepia)})`);
  if (a.blur > 0) parts.push(`blur(${round(a.blur)}px)`);
  return parts.length ? parts.join(' ') : 'none';
}

/** Blend layers in render order; shared by the live preview and the canvas pipeline. */
export function previewLayers(filter: FilterDefinition): BlendLayer[] {
  const layers = toneLayers(filter.adjustments);
  const e = filter.effects;
  if (e.grain > 0) layers.push(grainLayer(e.grain));
  if (e.vignette > 0) layers.push(vignetteLayer(e.vignette));
  if (e.glow > 0) layers.push(glowLayer(e.glow));
  if (e.lightLeak > 0) layers.push(lightLeakLayer(e.lightLeak));
  return layers;
}

export function previewStyle(filter: FilterDefinition): PreviewStyle {
  return { filter: toCssFilter(filter.adjustments), layers: previewLayers(filter) };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Renders a filter onto a frame. The pass order is fixed:
 * adjustments -> blur/sharpen -> tone layers -> grain -> vignette -> glow -> light leak
 * -> pixelate -> vhs -> overlays -> date stamp.
 */
@Injectable({ providedIn: 'root' })
export class FilterEngine {
  private readonly ctxFilterSupported = detectBrowserSupport().canvasFilter;

  /**
   * Draws `source` with `filter` applied into a new canvas of the same size (or the
   * supplied target). The source is never modified.
   */
  render(source: ImageBitmap | AnyCanvas, filter: FilterDefinition, target?: AnyCanvas): AnyCanvas {
    const width = source.width;
    const height = source.height;
    const canvas = target ?? createCanvas(width, height);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d') as Ctx | null;
    if (!ctx) throw new Error('2d context unavailable');

    const a = filter.adjustments;
    const e = filter.effects;

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    if (this.ctxFilterSupported) {
      const css = toCssFilter(a);
      ctx.filter = css;
      ctx.drawImage(source, 0, 0, width, height);
      ctx.filter = 'none';
    } else {
      ctx.drawImage(source, 0, 0, width, height);
      if (!isNeutralAdjustments(a)) {
        const matrix = buildColorMatrix(a);
        if (!isIdentityMatrix(matrix)) {
          const image = ctx.getImageData(0, 0, width, height);
          applyColorMatrix(image.data, matrix);
          ctx.putImageData(image, 0, 0);
        }
      }
    }
    ctx.restore();

    if (a.sharpen > 0) drawSharpen(ctx, width, height, a.sharpen);

    for (const layer of toneLayers(a)) drawSolidLayer(ctx, width, height, layer);
    drawGrain(ctx, width, height, e.grain);
    drawVignette(ctx, width, height, e.vignette);
    drawGlow(ctx, canvas, width, height, e.glow, this.ctxFilterSupported);
    drawLightLeak(ctx, width, height, e.lightLeak);
    drawPixelate(ctx, canvas, width, height, e.pixelate);
    drawVhs(ctx, canvas, width, height, e.vhs);
    drawOverlays(ctx, width, height, filter.overlays);
    if (e.dateStamp) drawDateStamp(ctx, width, height);

    return canvas;
  }
}
