import { clamp01, type Ctx } from './types';

/** Unsharp mask with a 3x3 box blur. Capture only; too costly per frame. */
export function drawSharpen(ctx: Ctx, width: number, height: number, amount: number): void {
  if (amount <= 0) return;
  const a = clamp01(amount) * 0.9;
  const image = ctx.getImageData(0, 0, width, height);
  const src = image.data;
  const out = new Uint8ClampedArray(src.length);
  const w4 = width * 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * w4 + x * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) continue;
            sum += src[yy * w4 + xx * 4 + c];
            count++;
          }
        }
        const p = src[i + c];
        out[i + c] = p + a * (p - sum / count);
      }
      out[i + 3] = src[i + 3];
    }
  }
  image.data.set(out);
  ctx.putImageData(image, 0, 0);
}
