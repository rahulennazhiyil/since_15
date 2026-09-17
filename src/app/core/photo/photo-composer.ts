import { Injectable, inject } from '@angular/core';
import { AppError } from '../errors/app-error';
import { FilterEngine } from '../filters/filter-engine';
import type { FilterDefinition } from '../filters/filter.model';
import { canvasToBlob, createCanvas, fitWithin, type AnyCanvas } from './image-encode';
import { LAYOUTS, coverCrop, heartPath, type LayoutId, type Rect } from './layouts';

export interface FrameStyle {
  background: string;
  text: string;
  caption: string;
  subcaption?: string;
}

export const DEFAULT_FRAME: FrameStyle = {
  background: '#fbf7f2',
  text: '#2b2622',
  caption: 'since060815',
};

/** Fixed locale so two devices produce byte-identical captions. */
export function formatPhotoDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface ComposeJob {
  /** Raw (unfiltered) frames or composed scenes in slot order. Reused cyclically if fewer than slots. */
  sources: (ImageBitmap | AnyCanvas)[];
  /** Applied to every source before compositing. Omit for Original. */
  filter?: FilterDefinition;
  layoutId: LayoutId;
  frame: FrameStyle;
  maxLongEdge: number;
  quality: number;
}

export interface ComposedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Turns one or more frames into a finished picture. Pure drawing: no camera, no
 * storage. Filters are applied to the sources before they get here.
 */
@Injectable({ providedIn: 'root' })
export class PhotoComposer {
  private readonly engine = inject(FilterEngine);

  async compose(job: ComposeJob): Promise<ComposedPhoto> {
    if (job.sources.length === 0) throw new AppError('photo-failed', { detail: 'no sources' });

    const layout = LAYOUTS[job.layoutId];
    const sources: (ImageBitmap | AnyCanvas)[] = job.filter
      ? job.sources.map((s) => this.engine.render(s, job.filter as FilterDefinition))
      : job.sources;
    const first = sources[0];
    const base = layout.compute({ width: first.width, height: first.height });
    const { width, height } = fitWithin(base.width, base.height, job.maxLongEdge);
    const scale = width / base.width;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as Ctx | null;
    if (!ctx) throw new AppError('photo-failed', { detail: 'no 2d context' });

    ctx.fillStyle = job.frame.background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    if (base.clip === 'heart') {
      ctx.beginPath();
      heartPath(ctx, width, height);
      ctx.clip();
    }
    base.slots.forEach((slot, i) => {
      const src = sources[i % sources.length];
      const dst = scaleRect(slot, scale);
      const crop = coverCrop(src.width, src.height, dst.width, dst.height);
      ctx.drawImage(src, crop.x, crop.y, crop.width, crop.height, dst.x, dst.y, dst.width, dst.height);
    });
    ctx.restore();

    if (base.caption) drawCaption(ctx, scaleRect(base.caption, scale), job.frame);

    const blob = await canvasToBlob(canvas, 'image/jpeg', job.quality);
    return { blob, width, height };
  }
}

function scaleRect(r: Rect, s: number): Rect {
  return {
    x: Math.round(r.x * s),
    y: Math.round(r.y * s),
    width: Math.round(r.width * s),
    height: Math.round(r.height * s),
  };
}

function drawCaption(ctx: Ctx, area: Rect, frame: FrameStyle): void {
  const centerX = area.x + area.width / 2;
  ctx.fillStyle = frame.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const mainSize = Math.round(area.height * 0.3);
  ctx.font = `600 ${mainSize}px "Manrope Variable", system-ui, sans-serif`;
  const mainY = frame.subcaption ? area.y + area.height * 0.42 : area.y + area.height / 2;
  ctx.fillText(frame.caption, centerX, mainY);

  if (frame.subcaption) {
    ctx.globalAlpha = 0.6;
    ctx.font = `500 ${Math.round(area.height * 0.18)}px "Manrope Variable", system-ui, sans-serif`;
    ctx.fillText(frame.subcaption, centerX, area.y + area.height * 0.7);
    ctx.globalAlpha = 1;
  }
}
