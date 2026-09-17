import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { uid } from '../../shared/utils/id';
import { ObjectUrlPool } from '../../shared/utils/object-url';
import { AppError, toAppError } from '../errors/app-error';
import type { FilterDefinition } from '../filters/filter.model';
import { ORIGINAL_FILTER } from '../filters/presets';
import { THUMBNAIL_EDGE } from '../filters/thumbnail-source';
import { canvasToBlob, createCanvas, fitWithin, type AnyCanvas } from '../photo/image-encode';
import { LAYOUTS, type LayoutId } from '../photo/layouts';
import { DEFAULT_FRAME, PhotoComposer, formatPhotoDate } from '../photo/photo-composer';
import { ScenePipeline, type ShotInput } from '../scene/scene-pipeline.service';
import { applyScenePatch, type PersonRole, type SceneState } from '../scene/scene.model';
import { decodeMask } from '../segmentation/mask-encode';
import type { BlobTransfer } from '../webrtc/blob-transfer';
import { BOOTH_MODES, type BoothMode, type BoothPhase, type BoothPhoto, type FrameGrab } from './booth-session';
import type { CaptureSchedule } from './capture-coordinator';

/** How long to wait for the partner's full-quality frame before composing from the video element. */
const PARTNER_FRAME_TIMEOUT_MS = 3000;
/** Long edge of the frame sent to the partner. Sharp enough for a print, small enough to send fast. */
const EXCHANGE_EDGE = 1280;
const EXCHANGE_QUALITY = 0.86;

export interface CoupleSessionDeps {
  /** Grabs this side's raw frame at full resolution. */
  grabLocal: FrameGrab;
  /** Grabs the partner's frame from their video element (fallback quality). */
  grabRemote: FrameGrab;
  blobs: () => BlobTransfer | null;
  isHost: () => boolean;
  /** Host clock -> local clock. */
  toLocalTime: (hostTime: number) => number;
  now: () => number;
}

/** Layout used for multi-shot modes; single-shot modes use the chosen pair layout. */
export function pairLayoutFor(mode: BoothMode, chosen: LayoutId): LayoutId {
  switch (mode) {
    case 'strip3':
      return 'pairStrip3';
    case 'strip4':
      return 'pairStrip4';
    case 'burst':
      return 'pairStrip4';
    default:
      return chosen;
  }
}

/** Frame for the shared scene: strips and bursts wrap several scenes, single shots the chosen frame. */
export function togetherLayoutFor(mode: BoothMode, chosen: LayoutId): LayoutId {
  switch (mode) {
    case 'strip3':
      return 'strip3';
    case 'strip4':
      return 'strip4';
    case 'burst':
      return 'grid4';
    default:
      return LAYOUTS[chosen]?.people === 1 ? chosen : 'single';
  }
}

/** Local fire times for every shot of a schedule. */
export function shotTimes(schedule: CaptureSchedule, toLocalTime: (t: number) => number): number[] {
  const first = toLocalTime(schedule.fireAt);
  return Array.from({ length: schedule.shots }, (_, i) => first + i * schedule.intervalMs);
}

interface ActiveCapture {
  schedule: CaptureSchedule;
  local: (ImageBitmap | null)[];
  remote: (ImageBitmap | null)[];
  localMask: (ImageBitmap | null)[];
  remoteMask: (ImageBitmap | null)[];
}

interface CapturedPair {
  captureId: string;
  local: ImageBitmap[];
  remote: ImageBitmap[];
  localMask: (ImageBitmap | null)[];
  remoteMask: (ImageBitmap | null)[];
  /** Which remote slots came from the partner's full-quality frame. */
  remoteFull: boolean[];
  /** Which remote masks came from the partner (rather than cut out here). */
  remoteMaskFull: boolean[];
  layout: LayoutId;
  quality: 'full' | 'preview';
  together: boolean;
  scene: SceneState | null;
}

/**
 * The couple booth state machine. Runs a schedule agreed over the data channel: both
 * devices count down to the same instant, grab their own frame, swap frames (and, in the
 * shared scene, masks), and compose the same picture.
 */
@Injectable()
export class CoupleSession {
  private readonly composer = inject(PhotoComposer);
  private readonly pipeline = inject(ScenePipeline);
  private readonly urls = new ObjectUrlPool();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private deps: CoupleSessionDeps | null = null;
  private blobSubscription: Subscription | null = null;

  private active: ActiveCapture | null = null;
  private lastPair: CapturedPair | null = null;
  private cancelled = false;
  private wake: (() => void) | null = null;

  readonly mode = signal<BoothMode>('single');
  readonly layout = signal<LayoutId>('pairSideBySide');
  readonly filter = signal<FilterDefinition>(ORIGINAL_FILTER);
  readonly phase = signal<BoothPhase>('idle');
  readonly countdownValue = signal<number | null>(null);
  readonly shotIndex = signal(0);
  readonly flashToken = signal(0);
  readonly photo = signal<BoothPhoto | null>(null);
  readonly photoQuality = signal<'full' | 'preview'>('full');
  readonly recomposing = signal(false);
  readonly revealThumb = signal<ImageBitmap | null>(null);
  readonly error = signal<AppError | null>(null);
  readonly activeCaptureId = signal<string | null>(null);

  readonly modeInfo = computed(() => BOOTH_MODES.find((m) => m.value === this.mode()) ?? BOOTH_MODES[0]);
  readonly busy = computed(() => this.phase() !== 'idle' && this.phase() !== 'review');
  readonly canCancel = computed(() => this.phase() === 'countdown');
  /** The reviewed photo is a shared scene (background and cutouts). */
  readonly reviewingScene = computed(() => this.phase() === 'review' && this.lastPair?.together === true);

  onTick: (() => void) | null = null;
  onShutter: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  bind(deps: CoupleSessionDeps): void {
    this.deps = deps;
    this.listenForFrames();
  }

  /** Call when the blob channel changes (new peer connection). */
  listenForFrames(): void {
    this.blobSubscription?.unsubscribe();
    this.blobSubscription = null;
    const blobs = this.deps?.blobs();
    if (!blobs) return;
    this.blobSubscription = blobs.blobs$.subscribe((received) => void this.onRemoteBlob(received.blob, received.meta));
  }

  setMode(mode: BoothMode): void {
    if (!this.busy()) this.mode.set(mode);
  }

  setLayout(layout: LayoutId): void {
    this.layout.set(layout);
    if (this.phase() === 'review' && this.lastPair) void this.recompose();
  }

  setFilter(filter: FilterDefinition): void {
    this.filter.set(filter);
    if (this.phase() === 'review' && this.lastPair) void this.recompose();
  }

  /** Scene changes made on the reveal screen re-render the shared picture. */
  setScene(scene: SceneState): void {
    const pair = this.lastPair;
    if (!pair || !pair.together) return;
    pair.scene = applyScenePatch(scene, {});
    if (this.phase() === 'review') void this.recompose();
  }

  /** Runs an agreed schedule. Resolves when the photo is ready or the run was cancelled. */
  async run(schedule: CaptureSchedule): Promise<void> {
    const deps = this.deps;
    if (!deps || this.busy()) return;
    this.cancelled = false;
    this.error.set(null);
    this.releasePair();
    this.setPhoto(null);
    this.activeCaptureId.set(schedule.captureId);
    const together = schedule.together && schedule.scene !== null;
    const blank = (): (ImageBitmap | null)[] => new Array<ImageBitmap | null>(schedule.shots).fill(null);
    this.active = { schedule, local: blank(), remote: blank(), localMask: blank(), remoteMask: blank() };
    const times = shotTimes(schedule, deps.toLocalTime);
    const layoutId = together
      ? togetherLayoutFor(schedule.mode, schedule.scene!.layoutId)
      : pairLayoutFor(schedule.mode, schedule.layoutId as LayoutId);

    try {
      for (let i = 0; i < schedule.shots; i++) {
        this.shotIndex.set(i);
        const showCountdown = i === 0 ? deps.now() < times[i] - 400 : schedule.intervalMs >= 2000;
        if (showCountdown) {
          this.phase.set('countdown');
          await this.countdownTo(times[i]);
        } else {
          await this.sleepUntil(times[i]);
        }
        if (this.cancelled) return this.finishCancel();

        this.phase.set('capturing');
        this.flashToken.update((n) => n + 1);
        this.onShutter?.();
        const raw = await deps.grabLocal();
        if (this.cancelled) {
          raw.close();
          return this.finishCancel();
        }
        // Both sides compose from the same encoded frames, so the two photos match.
        const encoded = await encodeForExchange(raw);
        raw.close();
        const frame = await createImageBitmap(encoded);
        this.active.local[i] = frame;
        if (together) {
          // Cut ourselves out at photo quality; the partner gets the same PNG we keep.
          const cut = await this.pipeline.maskForFrame(frame).catch(() => null);
          if (this.active?.schedule !== schedule) return;
          this.active.localMask[i] = cut?.bitmap ?? null;
          void this.sendBlobs(schedule.captureId, i, encoded, cut?.png ?? null);
        } else {
          void this.sendBlobs(schedule.captureId, i, encoded, null);
        }
      }

      this.phase.set('processing');
      await this.awaitPartnerFrames(times[times.length - 1] + PARTNER_FRAME_TIMEOUT_MS, together);
      if (this.cancelled) return this.finishCancel();

      const remote: ImageBitmap[] = [];
      const remoteFull: boolean[] = [];
      const remoteMask: (ImageBitmap | null)[] = [];
      const remoteMaskFull: boolean[] = [];
      let quality: 'full' | 'preview' = 'full';
      for (let i = 0; i < schedule.shots; i++) {
        let frame = this.active.remote[i];
        remoteFull.push(frame !== null);
        if (!frame) {
          frame = await deps.grabRemote();
          quality = 'preview';
          this.active.remote[i] = frame;
        }
        remote.push(frame);
        let mask = this.active.remoteMask[i];
        remoteMaskFull.push(mask !== null);
        if (together && !mask) {
          // Their mask never came: cut their frame out here. Close, but not identical.
          mask = (await this.pipeline.maskForFrame(frame).catch(() => null))?.bitmap ?? null;
          quality = 'preview';
        }
        remoteMask.push(mask);
      }
      this.lastPair = {
        captureId: schedule.captureId,
        local: this.active.local as ImageBitmap[],
        remote,
        localMask: this.active.localMask,
        remoteMask,
        remoteFull,
        remoteMaskFull,
        layout: layoutId,
        quality,
        together,
        scene: together ? schedule.scene : null,
      };
      this.active = null;
      await this.composeCurrent();
      this.revealThumb.set(await makeThumbnail(this.lastPair.local[0]).catch(() => null));
      this.phase.set('review');
    } catch (error) {
      this.error.set(toAppError(error, 'photo-failed'));
      this.countdownValue.set(null);
      this.phase.set('idle');
    } finally {
      this.activeCaptureId.set(null);
    }
  }

  cancel(): void {
    if (!this.canCancel()) return;
    this.cancelled = true;
    this.clearTimers();
    this.wake?.();
  }

  retake(): void {
    if (this.phase() !== 'review' || this.recomposing()) return;
    this.setPhoto(null);
    this.releasePair();
    this.phase.set('idle');
  }

  dispose(): void {
    this.cancelled = true;
    this.clearTimers();
    this.wake?.();
    this.blobSubscription?.unsubscribe();
    this.releasePair();
    this.setPhoto(null);
    this.urls.revokeAll();
  }

  /** Classic layouts: both sides draw the host first so the two photos are identical. */
  private orderedSources(pair: CapturedPair): ImageBitmap[] {
    if (!this.deps) return [];
    const [a, b] = this.deps.isHost() ? [pair.local, pair.remote] : [pair.remote, pair.local];
    const out: ImageBitmap[] = [];
    for (let i = 0; i < a.length; i++) out.push(a[i], b[i]);
    return out;
  }

  /** Shared scene: people are keyed by role, so the order is inherent. */
  private sceneShots(pair: CapturedPair): ShotInput[] {
    const selfRole: PersonRole = this.deps?.isHost() ? 'host' : 'guest';
    const otherRole: PersonRole = selfRole === 'host' ? 'guest' : 'host';
    return pair.local.map((frame, i) => ({
      people: [
        { role: selfRole, frame, mask: pair.localMask[i] ?? null },
        { role: otherRole, frame: pair.remote[i], mask: pair.remoteMask[i] ?? null },
      ],
    }));
  }

  private async composeCurrent(): Promise<void> {
    const pair = this.lastPair;
    if (!pair) return;
    const sources: (ImageBitmap | AnyCanvas)[] =
      pair.together && pair.scene ? await this.pipeline.renderShots(this.sceneShots(pair), { ...pair.scene, layoutId: pair.layout }) : this.orderedSources(pair);
    const composed = await this.composer.compose({
      sources,
      filter: this.filter(),
      layoutId: pair.layout,
      frame: { ...DEFAULT_FRAME, caption: 'together', subcaption: formatPhotoDate(new Date()) },
      maxLongEdge: environment.photo.maxLongEdge,
      quality: environment.photo.jpegQuality,
    });
    this.photoQuality.set(pair.quality);
    const previous = this.photo();
    this.setPhoto({
      id: previous?.id ?? uid('photo'),
      blob: composed.blob,
      url: this.urls.create(composed.blob),
      width: composed.width,
      height: composed.height,
      createdAt: previous?.createdAt ?? Date.now(),
      layoutId: pair.layout,
    });
  }

  private async recompose(): Promise<void> {
    const pair = this.lastPair;
    if (!pair) return;
    if (LAYOUTS[pair.layout].shots === 1) {
      pair.layout = pair.together && pair.scene ? togetherLayoutFor(this.mode(), pair.scene.layoutId) : pairLayoutFor(this.mode(), this.layout());
    }
    this.recomposing.set(true);
    try {
      await this.composeCurrent();
    } catch (error) {
      this.error.set(toAppError(error, 'photo-failed'));
    } finally {
      this.recomposing.set(false);
    }
  }

  /** Frame first, then its mask; the channel is serial so they arrive in order. */
  private async sendBlobs(captureId: string, shot: number, frame: Blob, mask: Blob | null): Promise<void> {
    const blobs = this.deps?.blobs();
    if (!blobs) return;
    try {
      await blobs.send(frame, { captureId, shot, kind: 'frame' });
      if (mask) await blobs.send(mask, { captureId, shot, kind: 'mask' });
    } catch {
      // The partner falls back to grabbing our video frame and cutting it out themselves.
    }
  }

  private async onRemoteBlob(blob: Blob, meta: Record<string, string | number | boolean>): Promise<void> {
    const kind = meta['kind'] ?? 'frame';
    if (kind !== 'frame' && kind !== 'mask') return;
    const shot = Number(meta['shot']);
    if (!Number.isInteger(shot) || shot < 0) return;
    const isMask = kind === 'mask';

    const active = this.active;
    if (active && meta['captureId'] === active.schedule.captureId && shot < active.remote.length) {
      try {
        const bitmap = isMask ? await decodeMask(blob) : await createImageBitmap(blob);
        if (this.active !== active) {
          bitmap.close();
          return;
        }
        const slots = isMask ? active.remoteMask : active.remote;
        slots[shot]?.close();
        slots[shot] = bitmap;
        this.wake?.();
      } catch {
        // Corrupt data: fall back to the video element / local cutout.
      }
      return;
    }
    // Data that arrived after we composed: quietly upgrade the photo.
    const pair = this.lastPair;
    if (!pair || meta['captureId'] !== pair.captureId || shot >= pair.remote.length) return;
    const already = isMask ? pair.remoteMaskFull[shot] : pair.remoteFull[shot];
    if (already || (isMask && !pair.together)) return;
    try {
      const bitmap = isMask ? await decodeMask(blob) : await createImageBitmap(blob);
      if (this.lastPair !== pair) {
        bitmap.close();
        return;
      }
      if (isMask) {
        pair.remoteMask[shot]?.close();
        pair.remoteMask[shot] = bitmap;
        pair.remoteMaskFull[shot] = true;
      } else {
        pair.remote[shot].close();
        pair.remote[shot] = bitmap;
        pair.remoteFull[shot] = true;
      }
      if (pair.remoteFull.every(Boolean) && (!pair.together || pair.remoteMaskFull.every(Boolean))) pair.quality = 'full';
      if (this.phase() === 'review') await this.recompose();
    } catch {
      // Keep the preview-quality version.
    }
  }

  private awaitPartnerFrames(deadline: number, withMasks: boolean): Promise<void> {
    return new Promise((resolve) => {
      const check = (): void => {
        const active = this.active;
        const complete = !active || (active.remote.every((f) => f !== null) && (!withMasks || active.remoteMask.every((m) => m !== null)));
        const done = complete || this.cancelled || (this.deps?.now() ?? 0) >= deadline;
        if (done) {
          this.wake = null;
          clearTimeout(timer);
          this.timers.delete(timer);
          resolve();
        }
      };
      const timer = setTimeout(check, Math.max(0, deadline - (this.deps?.now() ?? 0)));
      this.timers.add(timer);
      this.wake = check;
      check();
    });
  }

  private countdownTo(fireAt: number): Promise<void> {
    return new Promise((resolve) => {
      let last = -1;
      const tick = (): void => {
        const remaining = fireAt - (this.deps?.now() ?? 0);
        if (this.cancelled || remaining <= 0) {
          clearInterval(id);
          this.timers.delete(id);
          this.wake = null;
          this.countdownValue.set(null);
          resolve();
          return;
        }
        const value = Math.ceil(remaining / 1000);
        if (value !== last) {
          last = value;
          this.countdownValue.set(value);
          this.onTick?.();
        }
      };
      const id = setInterval(tick, 50);
      this.timers.add(id);
      this.wake = tick;
      tick();
    });
  }

  private sleepUntil(time: number): Promise<void> {
    return new Promise((resolve) => {
      const delay = Math.max(0, time - (this.deps?.now() ?? 0));
      const id = setTimeout(() => {
        this.timers.delete(id);
        resolve();
      }, delay);
      this.timers.add(id);
      this.wake = () => {
        clearTimeout(id);
        this.timers.delete(id);
        resolve();
      };
    });
  }

  private finishCancel(): void {
    this.countdownValue.set(null);
    const active = this.active;
    [active?.local, active?.remote, active?.localMask, active?.remoteMask].forEach((slots) => slots?.forEach((f) => f?.close()));
    this.active = null;
    this.phase.set('idle');
  }

  private setPhoto(photo: BoothPhoto | null): void {
    this.urls.revoke(this.photo()?.url);
    this.photo.set(photo);
  }

  private releasePair(): void {
    const pair = this.lastPair;
    if (pair) [pair.local, pair.remote, pair.localMask, pair.remoteMask].forEach((slots) => slots.forEach((f) => f?.close()));
    this.lastPair = null;
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

/** JPEG at the exchange size: what travels to the partner and what we keep for ourselves. */
async function encodeForExchange(frame: ImageBitmap): Promise<Blob> {
  const { width, height } = fitWithin(frame.width, frame.height, EXCHANGE_EDGE);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new AppError('photo-failed', { detail: 'no 2d context' });
  ctx.drawImage(frame, 0, 0, width, height);
  return canvasToBlob(canvas, 'image/jpeg', EXCHANGE_QUALITY);
}

async function makeThumbnail(source: ImageBitmap): Promise<ImageBitmap> {
  const { width, height } = fitWithin(source.width, source.height, THUMBNAIL_EDGE);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new AppError('photo-failed', { detail: 'no 2d context' });
  ctx.drawImage(source, 0, 0, width, height);
  return createImageBitmap(canvas);
}
