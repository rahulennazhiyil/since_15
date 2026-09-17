import { createCanvas, type AnyCanvas, type Size } from '../photo/image-encode';
import { coverCrop } from '../photo/layouts';
import { drawOrder, frameRect, type BackgroundFx, type PersonRole, type Placement } from './scene.model';

/**
 * Pure canvas 2D drawing of a scene: background, then people back to front. No
 * `ctx.filter` anywhere, so two devices with the same inputs paint the same pixels.
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Drawable = ImageBitmap | AnyCanvas | HTMLVideoElement | HTMLImageElement;

export interface PersonLayer {
  role: PersonRole;
  image: Drawable;
  /** Alpha mask covering the whole image; null draws the raw frame. */
  mask: Drawable | null;
  placement: Placement;
  /** Mirror on top of how the image was captured. */
  mirror: boolean;
}

export interface SceneInput {
  background: Drawable | null;
  /** Used where there is no background image. */
  surfaceColor: string;
  fx: BackgroundFx;
  people: PersonLayer[];
  front: PersonRole;
}

const MAX_BLUR_DOWNSCALE = 10;

export function drawableSize(d: Drawable): Size {
  if ('videoWidth' in d) return { width: d.videoWidth, height: d.videoHeight };
  if ('naturalWidth' in d) return { width: d.naturalWidth, height: d.naturalHeight };
  return { width: d.width, height: d.height };
}

export function drawScene(target: AnyCanvas, input: SceneInput, scratch: Scratch = new Scratch()): void {
  const ctx = target.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('no 2d context');
  const scene = { width: target.width, height: target.height };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  drawBackground(ctx, scene, input.background, input.fx, input.surfaceColor, scratch);
  drawPeople(ctx, scene, input.people, input.front, scratch);
}

export function drawBackground(ctx: Ctx, scene: Size, image: Drawable | null, fx: BackgroundFx, surfaceColor: string, scratch: Scratch): void {
  ctx.fillStyle = surfaceColor;
  ctx.fillRect(0, 0, scene.width, scene.height);
  if (image) {
    const size = drawableSize(image);
    if (size.width > 0 && size.height > 0) {
      const crop = coverCrop(size.width, size.height, scene.width, scene.height);
      if (fx.blur > 0) {
        // Blur = draw small, then draw big with smoothing. Deterministic and cheap.
        const factor = 1 + Math.round(fx.blur * (MAX_BLUR_DOWNSCALE - 1));
        const small = scratch.get('blur', Math.max(2, Math.round(scene.width / factor)), Math.max(2, Math.round(scene.height / factor)));
        const sctx = small.getContext('2d') as Ctx;
        sctx.imageSmoothingEnabled = true;
        sctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, small.width, small.height);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, scene.width, scene.height);
      } else {
        ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, scene.width, scene.height);
      }
    }
  }
  if (fx.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${(fx.dim * 0.65).toFixed(3)})`;
    ctx.fillRect(0, 0, scene.width, scene.height);
  }
}

export function drawPeople(ctx: Ctx, scene: Size, people: PersonLayer[], front: PersonRole, scratch: Scratch): void {
  const order = drawOrder(
    people.map((p) => p.role),
    front,
  );
  for (const role of order) {
    const layer = people.find((p) => p.role === role);
    if (layer) drawPerson(ctx, scene, layer, scratch);
  }
}

export function drawPerson(ctx: Ctx, scene: Size, layer: PersonLayer, scratch: Scratch): void {
  const size = drawableSize(layer.image);
  if (size.width <= 0 || size.height <= 0) return;
  const dst = frameRect(layer.placement, size, scene);
  const w = Math.max(1, Math.round(dst.width));
  const h = Math.max(1, Math.round(dst.height));

  // Cut the person out at the drawn size: frame, then keep only where the mask is.
  const cut = scratch.get(`person:${layer.role}`, w, h);
  const cctx = cut.getContext('2d') as Ctx;
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.globalCompositeOperation = 'source-over';
  cctx.clearRect(0, 0, w, h);
  cctx.imageSmoothingEnabled = true;
  cctx.drawImage(layer.image, 0, 0, w, h);
  if (layer.mask) {
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(layer.mask, 0, 0, w, h);
    cctx.globalCompositeOperation = 'source-over';
  }

  ctx.save();
  const mirror = layer.mirror !== layer.placement.flip;
  if (mirror) {
    ctx.translate(dst.x + w, dst.y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(dst.x, dst.y);
  }
  ctx.drawImage(cut, 0, 0, w, h);
  ctx.restore();
}

/** Reusable offscreen canvases keyed by purpose, resized in place. */
export class Scratch {
  private readonly canvases = new Map<string, AnyCanvas>();

  get(key: string, width: number, height: number): AnyCanvas {
    let c = this.canvases.get(key);
    if (!c) {
      c = createCanvas(width, height);
      this.canvases.set(key, c);
    }
    if (c.width !== width) c.width = width;
    if (c.height !== height) c.height = height;
    return c;
  }

  clear(): void {
    this.canvases.clear();
  }
}
