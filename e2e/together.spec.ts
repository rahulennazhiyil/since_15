import { expect, test, type Page } from '@playwright/test';
import { couplePhotoDigest, createRoom, joinRoom, sceneOf, waitForDataChannel, watchConsole } from './helpers';

/** Colour of one pixel of the reveal image, as [r, g, b]. */
async function revealPixel(page: Page, fx: number, fy: number): Promise<number[]> {
  return page.evaluate(
    async ([x, y]) => {
      const img = document.querySelector<HTMLImageElement>('app-photo-reveal img')!;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return Array.from(ctx.getImageData(Math.floor(c.width * x), Math.floor(c.height * y), 1, 1).data).slice(0, 3);
    },
    [fx, fy],
  );
}

test.describe('shared scene', () => {
  test('two people share one scene: background and placement follow, the photo is identical, own photos travel', async ({ context }) => {
    await context.addInitScript(() => localStorage.setItem('since060815:dev:segmenter', 'fake'));
    const errors: string[] = [];
    const host = await context.newPage();
    watchConsole(host, errors, 'host');
    const code = await createRoom(host);
    const guest = await joinRoom(context, code);
    watchConsole(guest, errors, 'guest');
    await waitForDataChannel(host);
    await waitForDataChannel(guest);

    // Both devices can cut people out, so both show one scene instead of two tiles.
    await expect(host.locator('app-scene-stage')).toBeVisible();
    await expect(guest.locator('app-scene-stage')).toBeVisible();
    expect(await host.locator('app-participant-view').count()).toBe(0);
    for (const page of [host, guest]) {
      await page.waitForFunction(() => {
        const videos = document.querySelectorAll<HTMLVideoElement>('app-scene-stage video');
        return videos.length === 2 && videos[0].videoWidth > 0 && videos[1].videoWidth > 0;
      });
    }
    await expect(host.locator('app-participant-badge .chip')).toContainText('Sam');

    // The host picks a background; the guest's scene follows.
    await host.click('.scene-actions button:has-text("Background")');
    await host.click('app-background-sheet button[role=radio]:has(img[alt="Neon booth"])');
    await host.keyboard.press('Escape');
    await expect.poll(() => sceneOf(guest).then((s) => s.backgroundId)).toBe('neon');
    await expect.poll(() => guest.evaluate(() => document.querySelector<HTMLElement>('app-scene-stage .bg')!.style.backgroundImage)).toContain('neon');

    // The guest drags themselves towards the middle; the host sees the new placement.
    const before = (await sceneOf(guest)).people['guest'].x;
    const box = (await guest.locator('app-scene-stage .scene').boundingBox())!;
    await guest.mouse.move(box.x + box.width * before, box.y + box.height * 0.6);
    await guest.mouse.down();
    await guest.mouse.move(box.x + box.width * (before - 0.15), box.y + box.height * 0.6, { steps: 6 });
    await guest.mouse.up();
    await expect.poll(() => sceneOf(host).then((s) => s.people['guest'].x)).toBeLessThan(before - 0.08);

    // Arrange sheet on the host: swap sides; the guest converges.
    await host.click('.scene-actions button:has-text("Arrange")');
    await host.click('app-arrange-sheet button:has-text("Swap sides")');
    await host.keyboard.press('Escape');
    await expect.poll(async () => (await sceneOf(guest)).people['host'].x > (await sceneOf(guest)).people['guest'].x).toBe(true);

    // The guest presses the shutter: both count down, both get the same merged picture.
    await guest.click('button[aria-label="Take photo"]');
    await expect(host.locator('app-photo-reveal img')).toBeVisible({ timeout: 25_000 });
    await expect(guest.locator('app-photo-reveal img')).toBeVisible({ timeout: 25_000 });
    await expect.poll(async () => [await couplePhotoDigest(host), await couplePhotoDigest(guest)].map((d) => d.quality).join()).toBe('full,full');
    const first = await couplePhotoDigest(host);
    await expect.poll(async () => (await couplePhotoDigest(guest)).sha, { timeout: 15_000 }).toBe(first.sha);
    expect(first.height).toBeGreaterThan(first.width); // portrait scene in the plain frame
    const corner = await revealPixel(host, 0.03, 0.03);
    expect(corner[2]).toBeGreaterThan(corner[1] + 20); // the neon wall, not camera bars

    // Changing the frame on the reveal re-renders both sides to the same picture.
    await host.click('app-photo-reveal [appChip]:has-text("Polaroid")');
    await expect.poll(async () => (await couplePhotoDigest(host)).sha, { timeout: 15_000 }).not.toBe(first.sha);
    const second = await couplePhotoDigest(host);
    await expect.poll(async () => (await couplePhotoDigest(guest)).sha, { timeout: 15_000 }).toBe(second.sha);
    expect(second.quality).toBe('full');

    // The guest brings their own photo: it is stored on both devices and the host's scene shows it.
    await host.click('button[aria-label="Back to camera"]');
    await guest.click('button[aria-label="Back to camera"]');
    await guest.click('.scene-actions button:has-text("Background")');
    await guest.locator('app-background-sheet input[type=file]').setInputFiles('public/backgrounds/thumbs/studio-sage.jpg');
    await expect.poll(() => sceneOf(host).then((s) => s.backgroundId)).toMatch(/^custom:/);
    await expect.poll(() => host.evaluate(() => document.querySelector<HTMLElement>('app-scene-stage .bg')!.style.backgroundImage), { timeout: 15_000 }).toContain('blob:');
    await expect
      .poll(() => guest.evaluate(() => (window as unknown as { ng: { getComponent: (el: Element) => { sceneSync: { partnerHas: () => Set<string> } } } }).ng.getComponent(document.querySelector('app-room-page')!).sceneSync.partnerHas().size))
      .toBe(1);
    await expect(guest.locator('app-toasts')).toContainText('has your background');

    expect(errors).toEqual([]);
  });
});
