// Generates e2e/fixtures/fake-cam.y4m: a small uncompressed clip with a moving circle.
// Chromium's built-in synthetic camera (--use-fake-device-for-media-stream alone) dies after
// about 1.5 s in current headless Chrome/Edge builds, so E2E runs must add
//   --use-file-for-fake-video-capture=<absolute path to fake-cam.y4m>
// Run: node e2e/fixtures/make-fake-camera.mjs
import { writeFileSync } from 'node:fs';
const W = 640, H = 480, FRAMES = 30;
const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420jpeg\n`);
const parts = [header];
for (let f = 0; f < FRAMES; f++) {
  const y = Buffer.alloc(W * H), u = Buffer.alloc((W * H) / 4), v = Buffer.alloc((W * H) / 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const cx = W / 2 + Math.sin(f / 5) * 120, cy = H / 2;
    const d = Math.hypot(i - cx, j - cy);
    y[j * W + i] = d < 110 ? 200 : 60 + ((i + f * 8) % 120);
  }
  for (let j = 0; j < H / 2; j++) for (let i = 0; i < W / 2; i++) { u[j * (W / 2) + i] = 100 + (i % 60); v[j * (W / 2) + i] = 150 - (j % 60); }
  parts.push(Buffer.from('FRAME\n'), y, u, v);
}
writeFileSync(new URL('./fake-cam.y4m', import.meta.url), Buffer.concat(parts));
console.log('wrote e2e/fixtures/fake-cam.y4m', Buffer.concat(parts).length, 'bytes');
