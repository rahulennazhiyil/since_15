import { expect, test } from '@playwright/test';
import { startCamera, useFakeSegmenter, watchConsole } from './helpers';

/**
 * Real-model smoke test. Off by default because it downloads the WASM runtime and runs
 * inference in software; run with `E2E_REAL_ML=1 npm run e2e -- ml-smoke`.
 */
test.describe('on-device segmentation model', () => {
  test.skip(!process.env['E2E_REAL_ML'], 'set E2E_REAL_ML=1 to run the real model');

  test('loads from our own origin and produces a mask', async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await useFakeSegmenter(page, 'real');
    const thirdParty: string[] = [];
    const ml: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.host !== 'localhost:4311') thirdParty.push(url.host);
      if (url.pathname.startsWith('/ml/')) ml.push(url.pathname);
    });

    await page.goto('/booth');
    await startCamera(page);
    await page.click('button[aria-label="Background"]');
    await page.click('app-background-sheet button[role=radio]:has(img[alt="Neon booth"])');
    await page.keyboard.press('Escape');

    // The stage appears and the model becomes ready within a generous budget.
    await expect(page.locator('app-scene-stage')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { ng: { getComponent: (el: Element) => { segmentation: { status: () => string } } } }).ng.getComponent(document.querySelector('app-booth-page')!).segmentation.status()), {
        timeout: 90_000,
      })
      .toBe('ready');
    expect(ml.some((p) => p.endsWith('.wasm'))).toBe(true);
    expect(ml.some((p) => p.endsWith('.tflite'))).toBe(true);
    expect(thirdParty).toEqual([]);

    // The people canvas receives a mask (some opaque, some transparent pixels) from live video.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const c = document.querySelector<HTMLCanvasElement>('app-scene-stage canvas.people')!;
            const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
            let opaque = 0;
            let clear = 0;
            for (let i = 3; i < data.length; i += 4 * 97) data[i] > 200 ? opaque++ : data[i] < 30 ? clear++ : 0;
            return { opaque, clear };
          }),
        { timeout: 20_000 },
      )
      .toMatchObject({ clear: expect.any(Number) });

    expect(errors).toEqual([]);
  });
});
