import { expect, test } from '@playwright/test';
import { couplePhotoDigest, createRoom, joinRoom, waitForDataChannel, watchConsole } from './helpers';

test.describe('rooms', () => {
  test('two people connect, take the same photo, and every room state reads right', async ({ page: host, context }) => {
    const errors: string[] = [];
    watchConsole(host, errors, 'host');

    const code = await createRoom(host);
    await expect(host.locator('app-connection-indicator')).toContainText('Waiting');
    await host.click('app-share-invite button[appButton]:has-text("Copy invite link")');
    expect(await host.evaluate(() => navigator.clipboard.readText())).toContain(`/room/${code}`);

    const guest = await joinRoom(context, code);
    watchConsole(guest, errors, 'guest');
    await expect(host.locator('app-connection-indicator')).toContainText('Connected');
    await expect(guest.locator('app-connection-indicator')).toContainText('Connected');
    await expect(host.locator('app-participant-view .chip')).toContainText('Sam');
    await expect(guest.locator('app-participant-view .chip')).toContainText('Rahul');

    // Media both ways
    for (const p of [host, guest]) {
      await p.waitForFunction(() => {
        const v = document.querySelector<HTMLVideoElement>('app-participant-view video');
        return !!v && v.videoWidth > 0 && !v.paused;
      }, null, { timeout: 20_000 });
    }
    await waitForDataChannel(host);
    await waitForDataChannel(guest);

    // Mic state travels
    await host.click('button[aria-label="Mute microphone"]');
    await expect(guest.locator('app-participant-view .chip app-icon')).toBeVisible();
    await host.click('button[aria-label="Unmute microphone"]');

    // Shared look, synchronized capture, identical result
    await host.click('app-room-page .layouts [appChip]:has-text("Polaroid")');
    await host.click('app-room-page app-filter-selector [appChip]:has-text("Vintage")');
    await host.click('app-room-page app-filter-selector .item[data-id="film"]');
    await guest.click('button[aria-label="Take photo"]');
    await expect(host.locator('app-countdown-overlay .number')).toBeVisible();
    await expect(guest.locator('app-countdown-overlay .number')).toBeVisible();
    await expect(host.locator('app-photo-reveal img')).toBeVisible({ timeout: 20_000 });
    await expect(guest.locator('app-photo-reveal img')).toBeVisible({ timeout: 20_000 });
    const a = await couplePhotoDigest(host);
    const b = await couplePhotoDigest(guest);
    expect(a.quality).toBe('full');
    expect(b.quality).toBe('full');
    expect(a).toEqual(b);
    await expect(host.locator('app-memory-wall .item')).toHaveCount(1);
    await expect(guest.locator('app-memory-wall .item')).toHaveCount(1);

    // Change the frame on the reveal
    await host.click('app-photo-reveal .layouts [appChip]:has-text("Heart")');
    await expect.poll(() => couplePhotoDigest(host).then((d) => d.width === d.height)).toBe(true);
    await host.click('button[aria-label="Back to camera"]');
    await guest.click('button[aria-label="Back to camera"]');

    // A third person is turned away before any camera prompt
    const third = await context.newPage();
    await third.goto(`/room/${code}`);
    await expect(third.getByText('This room is full')).toBeVisible({ timeout: 15_000 });
    expect(await third.$('app-camera-permission-intro')).toBeNull();
    await third.close();

    // Guest leaves and returns; host leaves and the guest sees the room end
    await guest.click('button[aria-label="Leave the room"]');
    await expect(host.locator('app-connection-indicator')).toContainText('Away');
    await expect(host.locator('.partner.away')).toContainText('left the room');
    await guest.goto(`/room/${code}`);
    await guest.locator('app-camera-permission-intro button[appButton]').click();
    await expect(host.locator('app-connection-indicator')).toContainText('Connected');

    await host.click('button[aria-label="Leave the room"]');
    await expect(guest.getByText('This room has ended')).toBeVisible({ timeout: 15_000 });
    expect(await guest.$('video')).toBeNull();

    expect(errors).toEqual([]);
  });

  test('unknown codes, bad codes and links in the join form', async ({ page }) => {
    await page.goto('/room/join');
    await page.fill('app-join-room-page .code-field input', 'https://example.com/room/zzzzzz');
    await expect(page.locator('app-join-room-page .code-field input')).toHaveValue('ZZZZZZ');
    await page.fill('app-join-room-page .code-field input', 'abc');
    await page.click('app-identity-form input[type=text]');
    await page.fill('app-identity-form input[type=text]', 'Lost');
    await page.click('app-identity-form button[type=submit]');
    await expect(page.locator('app-join-room-page .error')).toBeVisible();
    await page.fill('app-join-room-page .code-field input', 'ZZZZZZ');
    await page.click('app-identity-form button[type=submit]');
    await page.waitForURL(/\/room\/ZZZZZZ$/);
    await page.locator('app-camera-permission-intro button[appButton]').click();
    await expect(page.getByText('Finding your room')).toBeVisible();
    await expect(page.getByText('find that room')).toBeVisible({ timeout: 15_000 });
  });
});
