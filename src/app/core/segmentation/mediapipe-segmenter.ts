import type { ImageSegmenter, MPMask } from '@mediapipe/tasks-vision';
import { AppError } from '../errors/app-error';
import { confidenceToAlpha, finishMask } from './mask-ops';
import type { Mask, PersonSegmenter } from './segmenter';

export interface MediaPipeSegmenterOptions {
  /** Where `wasm/` and `models/` live, resolved against the document base. Default `ml/`. */
  assetBase?: string;
  delegate?: 'GPU' | 'CPU';
  /** Give up on model creation after this long. */
  createTimeoutMs?: number;
  /** Feather radius in probe pixels applied to every mask. */
  feather?: number;
  /** Weight of the previous mask (0..0.95) when the probe size is unchanged. */
  temporal?: number;
}

const MODEL_FILE = 'models/selfie_segmenter.tflite';

/**
 * The only file that talks to MediaPipe. The library and its WASM are loaded on demand
 * from our own origin; nothing leaves the device.
 */
export async function createMediaPipeSegmenter(options: MediaPipeSegmenterOptions = {}): Promise<PersonSegmenter> {
  const base = new URL(options.assetBase ?? 'ml/', document.baseURI).toString();
  const delegate = options.delegate ?? 'GPU';
  const timeoutMs = options.createTimeoutMs ?? 15_000;

  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(new URL('wasm', base).toString());

  const create = vision.ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: new URL(MODEL_FILE, base).toString(), delegate },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
  const segmenter = await withTimeout(create, timeoutMs, 'model did not load in time');
  return new MediaPipeSegmenter(segmenter, options);
}

class MediaPipeSegmenter implements PersonSegmenter {
  readonly kind = 'mediapipe' as const;
  private probe: HTMLCanvasElement | null = null;
  private lastTimestamp = 0;
  private prev: Uint8ClampedArray | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private readonly feather: number;
  private readonly temporal: number;

  constructor(
    private readonly segmenter: ImageSegmenter,
    options: MediaPipeSegmenterOptions,
  ) {
    this.feather = options.feather ?? 1;
    this.temporal = options.temporal ?? 0.4;
  }

  segment(source: CanvasImageSource, width: number, height: number): Promise<Mask> {
    const run = this.queue.then(() => this.segmentNow(source, width, height));
    this.queue = run.catch(() => undefined);
    return run;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.segmenter.close();
    } catch {
      /* already gone */
    }
    this.probe = null;
    this.prev = null;
  }

  private segmentNow(source: CanvasImageSource, width: number, height: number): Mask {
    if (this.disposed) throw new AppError('scene-unsupported', { detail: 'segmenter disposed' });
    if (width <= 0 || height <= 0) throw new AppError('photo-failed', { detail: 'empty probe' });

    const probe = this.ensureProbe(width, height);
    const ctx = probe.getContext('2d');
    if (!ctx) throw new AppError('photo-failed', { detail: 'no 2d context' });
    ctx.drawImage(source, 0, 0, width, height);

    // MediaPipe needs strictly increasing timestamps per instance.
    const timestamp = Math.max(this.lastTimestamp + 1, Math.round(performance.now()));
    this.lastTimestamp = timestamp;

    const result = this.segmenter.segmentForVideo(probe, timestamp);
    try {
      const mask = pickPersonMask(result.confidenceMasks);
      if (!mask) throw new AppError('scene-unsupported', { detail: 'no confidence mask' });
      const values = mask.hasFloat32Array() || mask.hasWebGLTexture() ? mask.getAsFloat32Array() : mask.getAsUint8Array();
      const alpha = confidenceToAlpha(values);
      const prev = this.prev && this.prev.length === alpha.length ? this.prev : null;
      const finished = finishMask(alpha, mask.width, mask.height, { prev, temporal: this.temporal, feather: this.feather });
      this.prev = finished.alpha;
      return finished;
    } finally {
      result.close();
    }
  }

  private ensureProbe(width: number, height: number): HTMLCanvasElement {
    if (!this.probe) this.probe = document.createElement('canvas');
    if (this.probe.width !== width || this.probe.height !== height) {
      this.probe.width = width;
      this.probe.height = height;
      this.prev = null; // size changed: temporal history no longer lines up
    }
    return this.probe;
  }
}

/**
 * The selfie model reports confidences per category. With two masks the second is the
 * person; with a single mask that one is the person.
 */
function pickPersonMask(masks: MPMask[] | undefined): MPMask | null {
  if (!masks || masks.length === 0) return null;
  return masks.length > 1 ? masks[1] : masks[0];
}

function withTimeout<T>(promise: Promise<T>, ms: number, detail: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AppError('scene-unsupported', { detail })), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(new AppError('scene-unsupported', { cause: error }));
      },
    );
  });
}
