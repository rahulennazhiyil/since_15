import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Emitted by the tests' own getImageData pixel checks, not by the app. */
const HARNESS_NOISE = /willReadFrequently/;

/** Collects console errors/warnings so every test can assert a clean console. */
export function watchConsole(page: Page, sink: string[], tag = ''): void {
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !HARNESS_NOISE.test(m.text())) {
      sink.push(`${tag ? `[${tag}] ` : ''}${m.type()}: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => sink.push(`${tag ? `[${tag}] ` : ''}pageerror: ${e.message}`));
}

/** Clicks the "Turn on camera" intro and waits for real frames. */
export async function startCamera(page: Page): Promise<void> {
  await page.locator('app-camera-permission-intro button[appButton]').click();
  await page.waitForFunction(() => {
    const v = document.querySelector<HTMLVideoElement>('app-camera-view video');
    return !!v && v.videoWidth > 0;
  });
}

export async function setIdentity(page: Page, name: string, vibe = '❤️'): Promise<void> {
  await page.fill('app-identity-form input[type=text]', name);
  await page.click(`app-identity-form .tile[aria-label="Vibe ${vibe}"]`);
  await page.click('app-identity-form button[type=submit]');
}

/** Creates a room as host; resolves with the room code once the camera is live. */
export async function createRoom(page: Page, name = 'Rahul'): Promise<string> {
  await page.goto('/room/new');
  await setIdentity(page, name, '✨');
  await page.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  const code = page.url().split('/').pop() as string;
  await startCamera(page);
  await expect(page.locator('app-room-waiting')).toBeVisible();
  return code;
}

/** Opens the invite link in a fresh tab of the same context with a different identity. */
export async function joinRoom(context: BrowserContext, code: string, name = 'Sam'): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/privacy');
  await page.evaluate(
    ({ name }) => {
      const raw = JSON.parse(localStorage.getItem('since060815:profile') ?? '{"v":1,"data":{}}');
      raw.data = { ...raw.data, name, emoji: '🌙' };
      localStorage.setItem('since060815:profile', JSON.stringify(raw));
    },
    { name },
  );
  await page.goto(`/room/${code}`);
  await startCamera(page);
  return page;
}

export async function waitForDataChannel(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { ng: { getComponent: (el: Element) => { media: { peer: { channelOpen: () => boolean } } } } }).ng.getComponent(document.querySelector('app-room-page')!)?.media.peer.channelOpen() === true,
    null,
    { timeout: 20_000 },
  );
}

/** SHA-256 prefix of the current couple photo; identical on both sides when it worked. */
export async function couplePhotoDigest(page: Page): Promise<{ sha: string; size: number; width: number; height: number; quality: string }> {
  return page.evaluate(async () => {
    const cmp = (window as unknown as { ng: { getComponent: (el: Element) => unknown } }).ng.getComponent(document.querySelector('app-room-page')!) as {
      couple: { photo: () => { blob: Blob; width: number; height: number }; photoQuality: () => string };
    };
    const photo = cmp.couple.photo();
    const digest = await crypto.subtle.digest('SHA-256', await photo.blob.arrayBuffer());
    return {
      sha: Array.from(new Uint8Array(digest)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join(''),
      size: photo.blob.size,
      width: photo.width,
      height: photo.height,
      quality: cmp.couple.photoQuality(),
    };
  });
}
