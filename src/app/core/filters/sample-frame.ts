import { createCanvas } from '../photo/image-encode';
import type { Ctx } from './passes/types';

let cached: Promise<ImageBitmap> | null = null;

/**
 * A generated stand-in scene for previewing filters when no camera is available:
 * warm sky, a soft "sun", rolling hills and two figures, so skin-ish tones, sky blues
 * and greens are all present.
 */
export function sampleFrame(width = 960, height = 720): Promise<ImageBitmap> {
  cached ??= (async () => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as Ctx;

    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.65);
    sky.addColorStop(0, '#6f9bd8');
    sky.addColorStop(0.55, '#f2c9b4');
    sky.addColorStop(1, '#f7e2c4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffe9b3';
    ctx.beginPath();
    ctx.arc(width * 0.72, height * 0.42, width * 0.07, 0, Math.PI * 2);
    ctx.fill();

    const hill = (y: number, amp: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 8) {
        ctx.lineTo(x, y + Math.sin((x / width) * Math.PI * 2 + amp) * height * 0.06);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
    };
    hill(height * 0.62, 0.4, '#8fb37d');
    hill(height * 0.7, 2.2, '#5f8c5a');
    hill(height * 0.8, 4.1, '#3f6a45');

    const person = (cx: number, skin: string, shirt: string, scale: number) => {
      const r = width * 0.045 * scale;
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.6, height);
      ctx.quadraticCurveTo(cx - r * 1.7, height - r * 3.2, cx, height - r * 3.4);
      ctx.quadraticCurveTo(cx + r * 1.7, height - r * 3.2, cx + r * 1.6, height);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(cx, height - r * 4.2, r, 0, Math.PI * 2);
      ctx.fill();
    };
    person(width * 0.38, '#d9a487', '#c9566e', 1.05);
    person(width * 0.58, '#8d5a3c', '#3c5a99', 1);

    return createImageBitmap(canvas);
  })();
  return cached;
}
