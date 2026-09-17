import type { Overlay, OverlayShape } from './filter.model';
import type { Ctx } from './passes/types';

export const UI_FONT = '"Manrope Variable", "Segoe UI", system-ui, sans-serif';
export const DISPLAY_FONT = '"Instrument Serif", Georgia, serif';

/** Absolute size in pixels of an overlay for a given image size. */
export function overlayPixelSize(overlay: Overlay, width: number, height: number): number {
  return overlay.scale * Math.min(width, height);
}

export function drawOverlays(ctx: Ctx, width: number, height: number, overlays: Overlay[]): void {
  for (const overlay of overlays) drawOverlay(ctx, width, height, overlay);
}

function drawOverlay(ctx: Ctx, width: number, height: number, o: Overlay): void {
  const size = overlayPixelSize(o, width, height);
  const cx = o.x * width;
  const cy = o.y * height;

  ctx.save();
  ctx.globalAlpha = o.opacity;
  ctx.translate(cx, cy);
  ctx.rotate((o.rotation * Math.PI) / 180);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (o.kind) {
    case 'emoji':
      ctx.font = `${size}px ${UI_FONT}`;
      ctx.fillText(o.content, 0, size * 0.04);
      break;
    case 'text':
      ctx.font = o.font === 'display' ? `italic ${size}px ${DISPLAY_FONT}` : `700 ${size}px ${UI_FONT}`;
      ctx.fillStyle = o.color ?? '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = size * 0.15;
      ctx.fillText(o.content, 0, 0);
      break;
    case 'shape':
      ctx.fillStyle = o.color ?? '#ffffff';
      drawShape(ctx, o.content as OverlayShape, size);
      break;
  }
  ctx.restore();
}

function drawShape(ctx: Ctx, shape: OverlayShape, size: number): void {
  const r = size / 2;
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.45;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      break;
    }
    case 'heart': {
      const s = size / 32;
      ctx.moveTo(0, 10 * s);
      ctx.bezierCurveTo(-18 * s, -4 * s, -8 * s, -18 * s, 0, -8 * s);
      ctx.bezierCurveTo(8 * s, -18 * s, 18 * s, -4 * s, 0, 10 * s);
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
}
