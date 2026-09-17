import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Not app problems: the tests' own getImageData pixel checks, and the one informational
 * line MediaPipe's WASM prints through console.warn when it creates its GPU context.
 */
const HARNESS_NOISE = /willReadFrequently|gl_context\.cc.*OpenGL error checking is disabled/;

/** Collects console errors/warnings so every test can assert a clean console. */
export function watchConsole(page: Page, sink: string[], tag = ''): void {
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !HARNESS_NOISE.test(m.text())) {
      sink.push(`${tag ? `[${tag}] ` : ''}${m.type()}: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => sink.push(`${tag ? `[${tag}] ` : ''}pageerror: ${e.message}`));
}

/**
 * Makes the app use the deterministic fake person segmenter (dev builds only), so scene
 * tests do not depend on the ML model or a GPU. Call before the first navigation.
 */
export type SegmenterMode = 'fake' | 'none' | 'real';
export async function useFakeSegmenter(page: Page, mode: SegmenterMode = 'fake'): Promise<void> {
  if (mode === 'real') return;
  await page.addInitScript((m) => localStorage.setItem('since060815:dev:segmenter', m), mode);
}

/** Clicks the "Turn on camera" intro and waits for real frames. */
export async function startCamera(page: Page): Promise<void> {
  await page.locator('app-camera-permission-intro button[appButton]').click();
  // Either the plain camera view or the shared scene's local video, whichever the page shows.
  await page.waitForFunction(() => {
    const v = document.querySelector<HTMLVideoElement>('app-camera-view video, app-scene-stage video');
    return !!v && v.videoWidth > 0;
  });
}

/** The room's shared scene state as the page sees it. */
export function sceneOf(page: Page): Promise<{ backgroundId: string; layoutId: string; front: string; people: Record<string, { x: number; y: number; scale: number; flip: boolean }> }> {
  return page.evaluate(() =>
    (window as unknown as { ng: { getComponent: (el: Element) => { sceneSync: { scene: () => never } } } }).ng.getComponent(document.querySelector('app-room-page')!).sceneSync.scene(),
  );
}

export async function setIdentity(page: Page, name: string, vibe = '❤️'): Promise<void> {
  await page.fill('app-identity-form input[type=text]', name);
  await page.click(`app-identity-form .tile[aria-label="Vibe ${vibe}"]`);
  await page.click('app-identity-form button[type=submit]');
}

/** Creates a room as host; resolves with the room code once the camera is live. */
export async function createRoom(page: Page, name = 'Rahul', segmenter: SegmenterMode = 'fake'): Promise<string> {
  await useFakeSegmenter(page, segmenter);
  await page.goto('/room/new');
  await setIdentity(page, name, '✨');
  await page.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  const code = page.url().split('/').pop() as string;
  await startCamera(page);
  await expect(page.locator('app-room-waiting')).toBeVisible();
  return code;
}

/** Opens the invite link in a fresh tab of the same context with a different identity. */
export async function joinRoom(context: BrowserContext, code: string, name = 'Sam', segmenter: SegmenterMode = 'fake'): Promise<Page> {
  const page = await context.newPage();
  await useFakeSegmenter(page, segmenter);
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
