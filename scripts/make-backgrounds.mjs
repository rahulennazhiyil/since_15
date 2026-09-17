// Rasterises scripts/backgrounds/*.svg into public/backgrounds/<id>.jpg (1080x1350) and
// 240 px thumbnails, using Playwright's bundled Chromium (already a dev dependency).
// Run with `npm run backgrounds`; the outputs are committed.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolve(root, 'scripts/backgrounds');
const outDir = resolve(root, 'public/backgrounds');
mkdirSync(resolve(outDir, 'thumbs'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
const wrap = (inner) => `<!doctype html><html><body style="margin:0;background:#000">${inner}</body></html>`;

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.svg'))) {
  const id = basename(file, '.svg');
  const svg = readFileSync(resolve(srcDir, file), 'utf8');
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  await page.setViewportSize({ width: 1080, height: 1350 });
  await page.setContent(wrap(`<img src="${dataUrl}" style="width:1080px;height:1350px;display:block">`));
  await page.locator('img').screenshot({ path: resolve(outDir, `${id}.jpg`), type: 'jpeg', quality: 86 });

  await page.setViewportSize({ width: 240, height: 300 });
  await page.setContent(wrap(`<img src="${dataUrl}" style="width:240px;height:300px;display:block">`));
  await page.locator('img').screenshot({ path: resolve(outDir, `thumbs/${id}.jpg`), type: 'jpeg', quality: 80 });
  console.log(`${id}.jpg`);
}
await browser.close();
