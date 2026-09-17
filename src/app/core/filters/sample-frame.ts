import { createCanvas } from '../photo/image-encode';
import type { Ctx } from './passes/types';

let cached: Promise<ImageBitmap> | null = null;

/**
 * The picture every filter thumbnail is rendered from. A calm, generated scene rather
 * than the live camera: a soft sky at golden hour, a low sun, hills, and two figures, so
 * skin tones, warm light, blues and greens are all present and the rail looks the same
 * for everyone, every time.
 */
export function sampleFrame(width = 640, height = 640): Promise<ImageBitmap> {
  cached ??= (async () => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as Ctx;

    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    sky.addColorStop(0, '#5b7fc7');
    sky.addColorStop(0.45, '#d9a3b0');
    sky.addColorStop(0.75, '#f6c9a6');
    sky.addColorStop(1, '#fbe3c4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Sun with a soft halo
    const halo = ctx.createRadialGradient(width * 0.68, height * 0.5, width * 0.02, width * 0.68, height * 0.5, width * 0.26);
    halo.addColorStop(0, 'rgba(255, 236, 190, 0.95)');
    halo.addColorStop(0.35, 'rgba(255, 220, 170, 0.45)');
    halo.addColorStop(1, 'rgba(255, 220, 170, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff1c9';
    ctx.beginPath();
    ctx.arc(width * 0.68, height * 0.5, width * 0.065, 0, Math.PI * 2);
    ctx.fill();

    // A few thin clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (const [cx, cy, w] of [
      [0.22, 0.2, 0.28],
      [0.6, 0.14, 0.22],
      [0.4, 0.3, 0.18],
    ]) {
      ctx.beginPath();
      ctx.ellipse(width * cx, height * cy, width * w * 0.5, height * 0.02, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const hill = (y: number, phase: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 8) {
        ctx.lineTo(x, y + Math.sin((x / width) * Math.PI * 2 + phase) * height * 0.05);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
    };
    hill(height * 0.66, 0.4, '#9fb98a');
    hill(height * 0.74, 2.2, '#6d9468');
    hill(height * 0.84, 4.1, '#456f4c');

    // Two figures, close together, backlit by the sun
    const person = (cx: number, skin: string, shirt: string, hair: string, scale: number) => {
      const r = width * 0.055 * scale;
      const base = height * 0.98;
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.7, base);
      ctx.quadraticCurveTo(cx - r * 1.8, base - r * 3.4, cx, base - r * 3.6);
      ctx.quadraticCurveTo(cx + r * 1.8, base - r * 3.4, cx + r * 1.7, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(cx, base - r * 4.4, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(cx, base - r * 4.6, r * 1.02, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
    };
    person(width * 0.4, '#d8a488', '#c9566e', '#4a2e22', 1.05);
    person(width * 0.56, '#8d5a3c', '#3c5a99', '#1e1410', 1);

    return createImageBitmap(canvas);
  })();
  return cached;
}
