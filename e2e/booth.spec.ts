import { expect, test } from '@playwright/test';
import { startCamera, watchConsole } from './helpers';

test.describe('solo booth', () => {
  test('capture, filter, re-filter, save, strip, memories and cleanup', async ({ page, context }) => {
    const errors: string[] = [];
    watchConsole(page, errors);

    await page.goto('/booth');
    await expect(page.locator('app-camera-permission-intro')).toBeVisible();
    expect(await page.$('app-header')).toBeNull();
    await startCamera(page);

    // Live filters: CSS filter + layers, canvas fallback for Pixel, overlays for Hearts
    await page.click('app-filter-selector [appChip]:has-text("Vintage")');
    await page.click('app-filter-selector .item[data-id="film"]');
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLVideoElement>('app-camera-view video')!.style.filter)).toContain('saturate');
    expect(await page.locator('app-filter-preview-layers .layer').count()).toBeGreaterThan(0);
    await page.click('app-filter-selector [appChip]:has-text("Fun")');
    await page.click('app-filter-selector .item[data-id="pixel"]');
    await expect(page.locator('app-camera-view canvas.fx')).toBeVisible();
    await page.click('app-filter-selector [appChip]:has-text("Couple")');
    await page.click('app-filter-selector .item[data-id="hearts"]');
    await expect(page.locator('app-filter-preview-layers .ov')).toHaveCount(3);
    await page.click('app-filter-selector [appChip]:has-text("Vintage")');
    await page.click('app-filter-selector .item[data-id="film"]');

    // Countdown -> reveal
    await page.click('button[aria-label="Take photo"]');
    await expect(page.locator('app-countdown-overlay .number')).toBeVisible();
    await expect(page.locator('app-photo-reveal img')).toBeVisible({ timeout: 15_000 });
    const size = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>('app-photo-reveal img')!;
      return [img.naturalWidth, img.naturalHeight];
    });
    expect(size[0]).toBeGreaterThan(0);

    // Re-filter without retaking
    const before = await page.evaluate(() => document.querySelector<HTMLImageElement>('app-photo-reveal img')!.src);
    await page.click('app-photo-reveal app-filter-selector [appChip]:has-text("Black & White")');
    await page.click('app-photo-reveal app-filter-selector .item[data-id="mono"]');
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLImageElement>('app-photo-reveal img')!.src)).not.toBe(before);

    // Save downloads a dated file
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('app-photo-reveal button:has-text("Save")')]);
    expect(download.suggestedFilename()).toMatch(/^since060815-\d{8}-\d{6}\.jpg$/);

    await page.click('app-photo-reveal button:has-text("Retake")');
    await expect(page.locator('app-photo-reveal')).toHaveCount(0);
    await expect(page.locator('app-memory-wall .item')).toHaveCount(1);

    // Strip of 3 with the countdown off, via the keyboard
    await page.click('app-mode-selector button:has-text("Strip · 3")');
    const pill = page.locator('app-camera-controls button.pill');
    for (let i = 0; i < 4 && (await pill.innerText()).trim() !== 'Off'; i++) await pill.click();
    await page.keyboard.press('Space');
    await expect(page.locator('app-photo-reveal img')).toBeVisible({ timeout: 20_000 });
    const strip = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>('app-photo-reveal img')!;
      return [img.naturalWidth, img.naturalHeight];
    });
    expect(strip[1]).toBeGreaterThan(strip[0]);
    await page.click('button[aria-label="Back to camera"]');
    await expect(page.locator('app-memory-wall .item')).toHaveCount(2);

    // Leaving stops the camera
    await page.evaluate(() => {
      (window as unknown as { __track: MediaStreamTrack }).__track = (document.querySelector<HTMLVideoElement>('app-camera-view video')!.srcObject as MediaStream).getVideoTracks()[0];
    });
    await page.click('button[aria-label="Leave the booth"]');
    await expect(page.locator('app-landing')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __track: MediaStreamTrack }).__track.readyState)).toBe('ended');

    // Memories keeps both photos; delete one; survives reload
    const memories = await context.newPage();
    await memories.goto('/memories');
    await expect(memories.locator('app-memories-page .cell')).toHaveCount(2);
    await memories.click('app-memories-page .cell >> nth=0');
    await memories.click('app-photo-viewer button:has-text("Delete")');
    await memories.click('app-photo-viewer button.btn-danger');
    await expect(memories.locator('app-memories-page .cell')).toHaveCount(1);
    await memories.reload();
    await expect(memories.locator('app-memories-page .cell')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('denied camera permission shows friendly copy', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    await page.goto('/booth');
    await page.locator('app-camera-permission-intro button[appButton]').click();
    await expect(page.locator('app-camera-permission-intro')).toContainText('Camera access was blocked');
    await expect(page.locator('app-camera-permission-intro button[appButton]')).toHaveText(/Try again/);
  });
});
