import { clamp01, type BlendLayer, type Ctx } from './types';

const TILE = 128;
let tile: HTMLCanvasElement | OffscreenCanvas | null = null;

/** mulberry32: tiny, deterministic, good enough for grain. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let tileDataUrl: string | null = null;

function noiseTile(): HTMLCanvasElement | OffscreenCanvas {
  if (tile) return tile;
  const canvas =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(TILE, TILE) : document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d') as Ctx;
  const img = ctx.createImageData(TILE, TILE);
  // Seeded so two devices render the same grain and end up with identical photos.
  const random = seededRandom(0x5eed);
  for (let i = 0; i < img.data.length; i += 4) {
    // Moderate amplitude: full-range noise reads as static rather than film grain.
    const v = 128 + Math.round((random() - 0.5) * 150);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tile = canvas;
  return canvas;
}

/** PNG data URL of the noise tile for the CSS preview. Built once, on a DOM canvas. */
export function grainDataUrl(): string {
  if (tileDataUrl) return tileDataUrl;
  const src = noiseTile();
  let dom: HTMLCanvasElement;
  if (src instanceof HTMLCanvasElement) {
    dom = src;
  } else {
    dom = document.createElement('canvas');
    dom.width = TILE;
    dom.height = TILE;
    dom.getContext('2d')?.drawImage(src, 0, 0);
  }
  tileDataUrl = dom.toDataURL('image/png');
  return tileDataUrl;
}

export function grainLayer(amount: number): BlendLayer {
  return { background: `url(${grainDataUrl()})`, blend: 'soft-light', opacity: clamp01(amount) * 0.6 };
}

export function drawGrain(ctx: Ctx, width: number, height: number, amount: number): void {
  if (amount <= 0) return;
  const pattern = ctx.createPattern(noiseTile(), 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = clamp01(amount) * 0.6;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
