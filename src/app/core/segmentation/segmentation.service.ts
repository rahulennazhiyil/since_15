import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { STORAGE_PREFIX } from '../storage/storage.service';
import { FakeSegmenter } from './fake-segmenter';
import { detectSegmentationSupport } from './segmentation-support';
import type { PersonSegmenter, SegmentationStatus, SegmenterKind } from './segmenter';

/** Development-only override: `fake` for tests, `cpu` to force the CPU delegate. */
export const DEV_SEGMENTER_KEY = `${STORAGE_PREFIX}dev:segmenter`;
type DevMode = 'fake' | 'cpu' | 'gpu' | null;

/**
 * Owns the single segmenter instance for the whole app. Loading is lazy, idempotent and
 * shared between the booth and the room; `prewarm()` starts the download while the user
 * is still reading the camera permission screen.
 */
@Injectable({ providedIn: 'root' })
export class SegmentationService {
  readonly status = signal<SegmentationStatus>('unknown');
  readonly kind = signal<SegmenterKind | null>(null);
  /** Milliseconds the last model load took, for the diagnostics screen. */
  readonly loadMs = signal<number | null>(null);

  private loading: Promise<PersonSegmenter | null> | null = null;
  private instance: PersonSegmenter | null = null;

  /** True once we know this device can run the model (or has been told to fake it). */
  get supported(): boolean {
    return devMode() === 'fake' || detectSegmentationSupport().ok;
  }

  current(): PersonSegmenter | null {
    return this.instance;
  }

  prewarm(): void {
    void this.load();
  }

  load(): Promise<PersonSegmenter | null> {
    if (this.instance) return Promise.resolve(this.instance);
    if (this.loading) return this.loading;
    this.loading = this.doLoad();
    return this.loading;
  }

  /** Forget a failed attempt so the next `load()` tries again (e.g. after a context loss). */
  reset(): void {
    this.instance?.dispose();
    this.instance = null;
    this.loading = null;
    this.status.set('unknown');
    this.kind.set(null);
  }

  private async doLoad(): Promise<PersonSegmenter | null> {
    if (!this.supported) {
      this.status.set('unsupported');
      return null;
    }
    this.status.set('loading');
    const started = performance.now();
    try {
      const mode = devMode();
      let segmenter: PersonSegmenter;
      if (mode === 'fake') {
        segmenter = new FakeSegmenter();
      } else {
        const { createMediaPipeSegmenter } = await import('./mediapipe-segmenter');
        const preferGpu = mode !== 'cpu' && detectSegmentationSupport().webgl2;
        try {
          segmenter = await createMediaPipeSegmenter({ delegate: preferGpu ? 'GPU' : 'CPU' });
        } catch (error) {
          if (!preferGpu) throw error;
          // Some GPUs reject the model; the CPU path is slower but works everywhere WASM does.
          segmenter = await createMediaPipeSegmenter({ delegate: 'CPU' });
        }
      }
      this.instance = segmenter;
      this.kind.set(segmenter.kind);
      this.loadMs.set(Math.round(performance.now() - started));
      this.status.set('ready');
      return segmenter;
    } catch {
      this.status.set('unsupported');
      this.loading = null;
      return null;
    }
  }
}

function devMode(): DevMode {
  if (environment.production) return null;
  try {
    const value = localStorage.getItem(DEV_SEGMENTER_KEY);
    return value === 'fake' || value === 'cpu' || value === 'gpu' ? value : null;
  } catch {
    return null;
  }
}
