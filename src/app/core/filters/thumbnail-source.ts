import { signal } from '@angular/core';

/** Long edge of the frame used for filter thumbnails. Small on purpose. */
export const THUMBNAIL_EDGE = 160;
const FIRST_FRAME_RETRY_MS = 250;

/**
 * Holds one small frozen frame that every filter thumbnail renders from. Refreshed on
 * a slow interval rather than per frame, which is the only recurring canvas work in
 * the live preview.
 */
export class ThumbnailSource {
  readonly bitmap = signal<ImageBitmap | null>(null);

  private timer: ReturnType<typeof setInterval> | null = null;
  private grab: (() => Promise<ImageBitmap>) | null = null;
  private inFlight = false;

  start(grab: () => Promise<ImageBitmap>, intervalMs = 3000): void {
    this.stop();
    this.grab = grab;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  /** Use a fixed frame (e.g. the photo just taken) instead of the live camera. */
  setStatic(bitmap: ImageBitmap | null): void {
    this.stop();
    this.replace(bitmap);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.grab = null;
  }

  dispose(): void {
    this.stop();
    this.replace(null);
  }

  private async tick(): Promise<void> {
    if (this.inFlight || !this.grab) return;
    this.inFlight = true;
    try {
      const next = await this.grab();
      // stop() may have run while we awaited; do not resurrect a stopped source.
      if (this.timer !== null) this.replace(next);
      else next.close();
    } catch {
      // Usually the camera has no frame yet. Retry soon rather than waiting a full interval,
      // so the rail fills in as soon as the preview is live.
      if (this.timer !== null && this.bitmap() === null) {
        setTimeout(() => void this.tick(), FIRST_FRAME_RETRY_MS);
      }
    } finally {
      this.inFlight = false;
    }
  }

  private replace(next: ImageBitmap | null): void {
    const previous = this.bitmap();
    this.bitmap.set(next);
    if (previous && previous !== next) previous.close();
  }
}
