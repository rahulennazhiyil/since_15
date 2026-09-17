import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { uid } from '../../shared/utils/id';
import { ObjectUrlPool } from '../../shared/utils/object-url';
import { AppError, toAppError } from '../errors/app-error';
import type { FilterDefinition } from '../filters/filter.model';
import { ORIGINAL_FILTER } from '../filters/presets';
import { THUMBNAIL_EDGE } from '../filters/thumbnail-source';
import { createCanvas, fitWithin } from '../photo/image-encode';
import type { LayoutId } from '../photo/layouts';
import { DEFAULT_FRAME, PhotoComposer, formatPhotoDate } from '../photo/photo-composer';
import { NO_BACKGROUND_ID } from '../scene/background-catalog';
import { ScenePipeline } from '../scene/scene-pipeline.service';
import { DEFAULT_SCENE, SOLO_PLACEMENT, applyScenePatch, type SceneState } from '../scene/scene.model';

export type BoothMode = 'single' | 'strip3' | 'strip4' | 'burst';
export type CountdownSeconds = 0 | 3 | 5 | 10;
export type BoothPhase = 'idle' | 'countdown' | 'capturing' | 'processing' | 'review';

export interface BoothModeInfo {
  value: BoothMode;
  label: string;
  shots: number;
  layout: LayoutId;
  /** Countdown before every shot after the first. */
  betweenCountdown: CountdownSeconds;
  /** Pause before every shot after the first when betweenCountdown is 0. */
  intervalMs: number;
}

export const BOOTH_MODES: readonly BoothModeInfo[] = [
  { value: 'single', label: 'Single', shots: 1, layout: 'single', betweenCountdown: 0, intervalMs: 0 },
  { value: 'strip3', label: 'Strip · 3', shots: 3, layout: 'strip3', betweenCountdown: 3, intervalMs: 0 },
  { value: 'strip4', label: 'Strip · 4', shots: 4, layout: 'strip4', betweenCountdown: 3, intervalMs: 0 },
  { value: 'burst', label: 'Burst', shots: 4, layout: 'grid4', betweenCountdown: 0, intervalMs: 650 },
];

export const COUNTDOWN_OPTIONS: readonly { value: CountdownSeconds; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 3, label: '3s' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
];

export interface BoothPhoto {
  /** Stable across re-filtering, so a saved copy is updated rather than duplicated. */
  id: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  createdAt: number;
  layoutId: LayoutId;
}

/** Supplied by the camera view: grabs the current frame at full resolution. */
export type FrameGrab = () => Promise<ImageBitmap>;

/**
 * State machine for one booth visit: mode, countdown, the capture sequence and the
 * resulting photo. Provided per page so leaving the booth disposes everything.
 */
@Injectable()
export class BoothSession {
  private readonly composer = inject(PhotoComposer);
  private readonly pipeline = inject(ScenePipeline);
  private readonly urls = new ObjectUrlPool();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private cancelled = false;
  /** Resolves the wait currently in progress so cancel() returns control immediately. */
  private pendingResolve: (() => void) | null = null;
  private lastBitmaps: ImageBitmap[] = [];
  /** One mask per captured frame (null when the frame was not cut out). */
  private lastMasks: (ImageBitmap | null)[] = [];

  /** Background and placement for the solo scene; `none` means the plain camera view. */
  readonly scene = signal<SceneState>({ ...DEFAULT_SCENE, people: { host: SOLO_PLACEMENT }, front: 'host' });
  readonly sceneEnabled = computed(() => this.scene().backgroundId !== NO_BACKGROUND_ID);

  readonly mode = signal<BoothMode>('single');
  readonly countdown = signal<CountdownSeconds>(3);
  readonly filter = signal<FilterDefinition>(ORIGINAL_FILTER);
  readonly phase = signal<BoothPhase>('idle');
  /** True while the reviewed photo is being re-rendered with a different filter. */
  readonly recomposing = signal(false);
  /** Small copy of the first captured frame, for filter thumbnails on the reveal screen. */
  readonly revealThumb = signal<ImageBitmap | null>(null);
  readonly countdownValue = signal<number | null>(null);
  readonly shotIndex = signal(0);
  /** Increments on every shutter so the flash overlay can re-trigger. */
  readonly flashToken = signal(0);
  readonly photo = signal<BoothPhoto | null>(null);
  readonly error = signal<AppError | null>(null);

  readonly modeInfo = computed(() => BOOTH_MODES.find((m) => m.value === this.mode()) ?? BOOTH_MODES[0]);
  readonly busy = computed(() => this.phase() !== 'idle' && this.phase() !== 'review');
  readonly canCancel = computed(() => this.phase() === 'countdown');

  /** Sound hooks; the page wires these to SoundService. */
  onTick: (() => void) | null = null;
  onShutter: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  setMode(mode: BoothMode): void {
    if (!this.busy()) this.mode.set(mode);
  }

  setCountdown(seconds: CountdownSeconds): void {
    if (!this.busy()) this.countdown.set(seconds);
  }

  /** Changes the filter; on the reveal screen the photo is re-rendered without a retake. */
  setFilter(filter: FilterDefinition): void {
    if (this.busy()) return;
    this.filter.set(filter);
    if (this.phase() === 'review' && this.lastBitmaps.length > 0) void this.recompose();
  }

  /** Changes background, effects or placement; on the reveal screen the photo is re-rendered. */
  setScene(patch: Partial<SceneState>): void {
    if (this.busy()) return;
    this.scene.update((scene) => applyScenePatch(scene, patch));
    if (this.phase() === 'review' && this.lastBitmaps.length > 0) void this.recompose();
  }

  setBackground(backgroundId: string): void {
    this.setScene({ backgroundId });
  }

  async capture(grab: FrameGrab): Promise<void> {
    if (this.busy()) return;
    this.cancelled = false;
    this.error.set(null);
    this.releaseBitmaps();
    this.shotIndex.set(0);
    const info = this.modeInfo();

    try {
      for (let i = 0; i < info.shots; i++) {
        this.shotIndex.set(i);
        const seconds = i === 0 ? this.countdown() : info.betweenCountdown;
        if (seconds > 0) {
          this.phase.set('countdown');
          await this.runCountdown(seconds);
        } else if (i > 0 && info.intervalMs > 0) {
          await this.delay(info.intervalMs);
        }
        if (this.cancelled) return this.finishCancel();

        this.phase.set('capturing');
        this.flashToken.update((n) => n + 1);
        this.onShutter?.();
        const frame = await grab();
        this.lastBitmaps.push(frame);
        // Cut the person out at photo quality; a failed mask falls back to the raw frame.
        this.lastMasks.push(this.sceneEnabled() ? await this.pipeline.maskForFrame(frame).then((m) => m?.bitmap ?? null, () => null) : null);
      }

      this.phase.set('processing');
      await this.composeCurrent();
      // The reveal-screen thumbnails are a nicety; never let them fail the photo.
      this.revealThumb.set(await makeThumbnail(this.lastBitmaps[0]).catch(() => null));
      this.phase.set('review');
    } catch (error) {
      this.error.set(toAppError(error, 'photo-failed'));
      this.countdownValue.set(null);
      this.phase.set('idle');
    }
  }

  cancel(): void {
    if (!this.canCancel()) return;
    this.cancelled = true;
    this.clearTimers();
    this.pendingResolve?.();
    this.pendingResolve = null;
  }

  retake(): void {
    if (this.phase() !== 'review' || this.recomposing()) return;
    this.setPhoto(null);
    this.releaseBitmaps();
    this.phase.set('idle');
  }

  dispose(): void {
    this.cancelled = true;
    this.clearTimers();
    this.pendingResolve?.();
    this.pendingResolve = null;
    this.releaseBitmaps();
    this.setPhoto(null);
    this.urls.revokeAll();
  }

  private async composeCurrent(): Promise<void> {
    const info = this.modeInfo();
    // With a background the scene is rendered first; the frame then wraps that picture.
    const sources = this.sceneEnabled()
      ? await this.pipeline.renderShots(
          this.lastBitmaps.map((frame, i) => ({ people: [{ role: 'host' as const, frame, mask: this.lastMasks[i] ?? null }] })),
          { ...this.scene(), layoutId: info.layout },
        )
      : this.lastBitmaps;
    const composed = await this.composer.compose({
      sources,
      filter: this.filter(),
      layoutId: info.layout,
      frame: { ...DEFAULT_FRAME, subcaption: formatPhotoDate(new Date()) },
      maxLongEdge: environment.photo.maxLongEdge,
      quality: environment.photo.jpegQuality,
    });
    const previous = this.photo();
    this.setPhoto({
      id: previous?.id ?? uid('photo'),
      blob: composed.blob,
      url: this.urls.create(composed.blob),
      width: composed.width,
      height: composed.height,
      createdAt: previous?.createdAt ?? Date.now(),
      layoutId: info.layout,
    });
  }

  private async recompose(): Promise<void> {
    this.recomposing.set(true);
    try {
      await this.composeCurrent();
    } catch (error) {
      this.error.set(toAppError(error, 'photo-failed'));
    } finally {
      this.recomposing.set(false);
    }
  }

  private runCountdown(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      let remaining = seconds;
      this.countdownValue.set(remaining);
      this.onTick?.();
      const finish = (): void => {
        clearInterval(id);
        this.timers.delete(id);
        this.pendingResolve = null;
        this.countdownValue.set(null);
        resolve();
      };
      const id = setInterval(() => {
        remaining -= 1;
        if (this.cancelled || remaining <= 0) {
          finish();
          return;
        }
        this.countdownValue.set(remaining);
        this.onTick?.();
      }, 1000);
      this.timers.add(id);
      this.pendingResolve = finish;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const finish = (): void => {
        clearTimeout(id);
        this.timers.delete(id);
        this.pendingResolve = null;
        resolve();
      };
      const id = setTimeout(finish, ms);
      this.timers.add(id);
      this.pendingResolve = finish;
    });
  }

  private finishCancel(): void {
    this.countdownValue.set(null);
    this.releaseBitmaps();
    this.phase.set('idle');
  }

  private setPhoto(photo: BoothPhoto | null): void {
    this.urls.revoke(this.photo()?.url);
    this.photo.set(photo);
  }

  private releaseBitmaps(): void {
    this.lastBitmaps.forEach((b) => b.close?.());
    this.lastBitmaps = [];
    this.lastMasks.forEach((m) => m?.close?.());
    this.lastMasks = [];
    this.revealThumb()?.close?.();
    this.revealThumb.set(null);
  }

  private clearTimers(): void {
    this.timers.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
    this.timers.clear();
  }
}


/** Small copy for thumbnails, drawn through a canvas so the source bitmap stays untouched. */
async function makeThumbnail(source: ImageBitmap): Promise<ImageBitmap> {
  const { width, height } = fitWithin(source.width, source.height, THUMBNAIL_EDGE);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new AppError('photo-failed', { detail: 'no 2d context' });
  ctx.drawImage(source, 0, 0, width, height);
  return createImageBitmap(canvas);
}
