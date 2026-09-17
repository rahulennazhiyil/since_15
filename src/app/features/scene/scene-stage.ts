import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FrameGrabber } from '../../core/camera/frame-grabber';
import { FilterEngine, toCssFilter } from '../../core/filters/filter-engine';
import { needsCanvasPreview, type FilterDefinition } from '../../core/filters/filter.model';
import { ORIGINAL_FILTER } from '../../core/filters/presets';
import { createCanvas, fitWithin, type AnyCanvas, type Size } from '../../core/photo/image-encode';
import { BackgroundResolver } from '../../core/scene/background-resolver';
import { Scratch, drawPeople, drawScene, type PersonLayer } from '../../core/scene/scene-compositor';
import { SCENE_SURFACE } from '../../core/scene/scene-pipeline.service';
import {
  DEFAULT_PLACEMENTS,
  PERSON_ROLES,
  bodyRect,
  clampPlacement,
  hitTest,
  sceneSizeOf,
  type ArrangeInput,
  type PersonRole,
  type Placement,
  type SceneState,
} from '../../core/scene/scene.model';
import { maskToCanvas } from '../../core/segmentation/mask-encode';
import { SegmentationService } from '../../core/segmentation/segmentation.service';
import { LIVE_PROBE_EDGE, type NormRect } from '../../core/segmentation/segmenter';
import { FilterPreviewLayers } from '../filters/filter-preview-layers';

export interface PlacementEvent {
  role: PersonRole;
  placement: Placement;
}

interface SourceState {
  role: PersonRole;
  video: HTMLVideoElement;
  mirrored: boolean;
  intervalMs: number;
  lastSegmentAt: number;
  lastFrameTime: number;
  inflight: boolean;
  maskCanvas: AnyCanvas | null;
  /** In drawn orientation (camera mirroring applied). */
  bbox: NormRect | null;
}

const DRAW_FPS = 30;
const PHONE_WIDTH = 700;
const SLOW_INFERENCE_MS = 40;
const KEY_NUDGE = 0.01;
const KEY_NUDGE_LARGE = 0.05;
const MAX_BLUR_PX = 24;

/**
 * The live shared scene: background layer, the people cut out of their cameras on a
 * canvas, filter layers on top. One segmenter instance is time-sliced between the local
 * camera and the partner's video. Drag, pinch, wheel and arrow keys move and scale people;
 * the component only reports changes, the page owns the scene state.
 */
@Component({
  selector: 'app-scene-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterPreviewLayers],
  template: `
    <div
      #scene
      class="scene"
      [style.aspect-ratio]="aspectCss()"
      [style.--ar]="arValue()"
      [style.filter]="canvasMode() ? null : cssFilter()"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerEnd($event)"
      (pointercancel)="onPointerEnd($event)"
      (wheel)="onWheel($event)"
    >
      <div class="bg" [class.hidden]="canvasMode()" [style.background-image]="bgCss()" [style.filter]="bgFilter()"></div>
      <canvas #people class="people" aria-hidden="true"></canvas>
      @if (!canvasMode()) {
        <app-filter-preview-layers [filter]="filter()" />
      }
      @if (interactive()) {
        @for (h of handles(); track h.role) {
          <button
            type="button"
            class="handle"
            [style.left.%]="h.left"
            [style.top.%]="h.top"
            [style.width.%]="h.width"
            [style.height.%]="h.height"
            [attr.aria-label]="h.label"
            (keydown)="onHandleKey($event, h.role)"
          ></button>
        }
      }
      @if (statusLabel(); as label) {
        <div class="status" role="status">{{ label }}</div>
      }
    </div>
    <video #local class="src" muted playsinline autoplay></video>
    <video #remote class="src" playsinline autoplay></video>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      container-type: size;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    /* Fills the width, or the height when that is the tighter constraint. */
    .scene {
      position: relative;
      width: min(100%, calc(100cqh * var(--ar, 0.8)));
      margin: 0 auto;
      overflow: hidden;
      background: #1c1a20;
      border-radius: var(--radius-scene, 0);
    }
    .bg,
    .people {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .bg {
      background-size: cover;
      background-position: center;
      transform: scale(1.04);
    }
    .bg.hidden {
      visibility: hidden;
    }
    .src {
      position: absolute;
      width: 2px;
      height: 2px;
      opacity: 0;
      pointer-events: none;
    }
    .handle {
      position: absolute;
      border: 2px dashed transparent;
      border-radius: var(--radius-md);
      background: transparent;
      pointer-events: none;
    }
    .handle:focus-visible {
      border-color: #fff;
      outline: none;
      box-shadow: 0 0 0 3px rgb(0 0 0 / 0.4);
    }
    .status {
      position: absolute;
      left: 50%;
      bottom: var(--space-4);
      transform: translateX(-50%);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 0.5);
      color: #fff;
      font-size: var(--text-sm);
      font-weight: 600;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      white-space: nowrap;
    }
  `,
})
export class SceneStage {
  readonly localStream = input.required<MediaStream | null>();
  readonly localMirrored = input(false);
  readonly remoteStream = input<MediaStream | null>(null);
  readonly remoteMirrored = input(false);
  /** Which role the local camera plays in the scene. */
  readonly selfRole = input<PersonRole>('host');
  readonly scene = input.required<SceneState>();
  readonly filter = input<FilterDefinition>(ORIGINAL_FILTER);
  readonly interactive = input(true);
  /** Stops segmentation (masks freeze) while a photo is being taken. */
  readonly paused = input(false);

  readonly placementChange = output<PlacementEvent>();
  readonly placementCommit = output<PlacementEvent>();
  readonly frontChange = output<PersonRole>();

  private readonly sceneEl = viewChild.required<ElementRef<HTMLDivElement>>('scene');
  private readonly peopleRef = viewChild.required<ElementRef<HTMLCanvasElement>>('people');
  private readonly localRef = viewChild.required<ElementRef<HTMLVideoElement>>('local');
  private readonly remoteRef = viewChild.required<ElementRef<HTMLVideoElement>>('remote');

  private readonly segmentation = inject(SegmentationService);
  private readonly backgrounds = inject(BackgroundResolver);
  private readonly engine = inject(FilterEngine);
  private readonly grabber = new FrameGrabber();
  private readonly remoteGrabber = new FrameGrabber();
  private readonly scratch = new Scratch();

  protected readonly cssFilter = computed(() => toCssFilter(this.filter().adjustments));
  protected readonly canvasMode = computed(() => needsCanvasPreview(this.filter()));
  protected readonly sceneSize = computed(() => sceneSizeOf(this.scene().layoutId));
  protected readonly aspectCss = computed(() => `${this.sceneSize().width} / ${this.sceneSize().height}`);
  protected readonly arValue = computed(() => (this.sceneSize().width / this.sceneSize().height).toFixed(4));
  protected readonly bgUrl = signal<string | null>(null);
  protected readonly bgCss = computed(() => (this.bgUrl() ? `url("${this.bgUrl()}")` : null));
  protected readonly bgFilter = computed(() => {
    const { blur, dim } = this.scene().fx;
    const parts: string[] = [];
    if (blur > 0) parts.push(`blur(${(blur * MAX_BLUR_PX).toFixed(1)}px)`);
    if (dim > 0) parts.push(`brightness(${(1 - dim * 0.65).toFixed(3)})`);
    return parts.length ? parts.join(' ') : null;
  });
  protected readonly statusLabel = computed(() => (this.segmentation.status() === 'loading' ? 'Setting up your scene…' : null));

  /** Bumped whenever a mask or video size changes so handle positions recompute. */
  private readonly maskVersion = signal(0);
  protected readonly handles = computed(() => {
    this.maskVersion();
    const scene = this.scene();
    const size = this.sceneSize();
    return this.presentSources().map((s) => {
      const placement = scene.people[s.role] ?? DEFAULT_PLACEMENTS[s.role];
      const r = bodyRect(placement, videoSize(s.video), s.bbox, size);
      return {
        role: s.role,
        left: (r.x / size.width) * 100,
        top: (r.y / size.height) * 100,
        width: (r.width / size.width) * 100,
        height: (r.height / size.height) * 100,
        label: `${s.role === this.selfRole() ? 'You' : 'Your person'}. Arrow keys move, plus and minus resize, Enter brings to the front.`,
      };
    });
  });

  private sources: SourceState[] = [];
  private loopHandle: number | null = null;
  private lastDrawAt = 0;
  private inferenceEma = 0;
  private bgBitmap: ImageBitmap | null = null;
  private drag: { pointers: Map<number, { x: number; y: number }>; role: PersonRole; start: Placement; startDist: number; origin: { x: number; y: number } } | null = null;

  constructor() {
    this.segmentation.prewarm();

    effect(() => this.bindVideo(this.localRef().nativeElement, this.localStream(), true));
    effect(() => this.bindVideo(this.remoteRef().nativeElement, this.remoteStream(), false));

    // Sources follow the streams and roles.
    effect(() => {
      const self = this.selfRole();
      const other: PersonRole = self === 'host' ? 'guest' : 'host';
      const phone = typeof window !== 'undefined' && window.innerWidth < PHONE_WIDTH;
      const local: SourceState = this.makeSource(self, this.localRef().nativeElement, this.localMirrored(), phone ? 50 : 42);
      const remote: SourceState | null = this.remoteStream() ? this.makeSource(other, this.remoteRef().nativeElement, this.remoteMirrored(), phone ? 100 : 83) : null;
      untracked(() => {
        this.sources = remote ? [local, remote] : [local];
        this.maskVersion.update((n) => n + 1);
      });
    });

    // Background URL for the CSS layer and bitmap for canvas mode.
    effect(() => {
      const id = this.scene().backgroundId;
      void this.backgrounds.url(id).then((url) => this.bgUrl.set(url));
      void this.backgrounds.resolve(id).then((bmp) => (this.bgBitmap = bmp));
    });

    effect(() => {
      const el = this.peopleRef().nativeElement;
      const size = this.sceneSize();
      const dpr = Math.min(1.5, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
      const rect = el.getBoundingClientRect();
      const target = fitWithin(size.width, size.height, Math.max(320, Math.round(Math.max(rect.width, rect.height) * dpr)));
      if (el.width !== target.width || el.height !== target.height) {
        el.width = target.width;
        el.height = target.height;
      }
    });

    const onVisibility = (): void => (document.hidden ? this.stopLoop() : this.startLoop());
    document.addEventListener('visibilitychange', onVisibility);
    this.startLoop();

    inject(DestroyRef).onDestroy(() => {
      this.stopLoop();
      document.removeEventListener('visibilitychange', onVisibility);
      this.localRef().nativeElement.srcObject = null;
      this.remoteRef().nativeElement.srcObject = null;
      this.grabber.dispose();
      this.remoteGrabber.dispose();
      this.scratch.clear();
    });
  }

  /** Full-resolution copy of the local camera, mirrored the way the user sees it. */
  grabFrame(maxLongEdge?: number): Promise<ImageBitmap> {
    return this.grabber.grab(this.localRef().nativeElement, { mirror: this.localMirrored(), maxLongEdge });
  }

  /** Copy of the partner's video, in the orientation they captured it. */
  grabRemoteFrame(maxLongEdge?: number): Promise<ImageBitmap> {
    return this.remoteGrabber.grab(this.remoteRef().nativeElement, { mirror: this.remoteMirrored(), maxLongEdge });
  }

  /** Frame sizes and body boxes of everyone currently visible, for auto-arrange. */
  arrangeInputs(): ArrangeInput[] {
    return this.presentSources().map((s) => ({ role: s.role, frame: videoSize(s.video), bbox: s.bbox }));
  }

  private makeSource(role: PersonRole, video: HTMLVideoElement, mirrored: boolean, intervalMs: number): SourceState {
    const previous = this.sources.find((s) => s.role === role && s.video === video);
    return {
      role,
      video,
      mirrored,
      intervalMs,
      lastSegmentAt: 0,
      lastFrameTime: -1,
      inflight: false,
      maskCanvas: previous?.maskCanvas ?? null,
      bbox: previous?.bbox ?? null,
    };
  }

  private bindVideo(el: HTMLVideoElement, stream: MediaStream | null, mute: boolean): void {
    if (mute) el.muted = true;
    el.playsInline = true;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) el.play().catch(() => undefined);
  }

  private presentSources(): SourceState[] {
    return this.sources.filter((s) => s.video.videoWidth > 0);
  }

  // ---- render loop ----------------------------------------------------------------

  private startLoop(): void {
    if (this.loopHandle !== null) return;
    const step = (now: number): void => {
      this.loopHandle = requestAnimationFrame(step);
      this.tick(now);
    };
    this.loopHandle = requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this.loopHandle !== null) cancelAnimationFrame(this.loopHandle);
    this.loopHandle = null;
  }

  private tick(now: number): void {
    if (!this.paused()) this.segmentDue(now);
    if (now - this.lastDrawAt < 1000 / DRAW_FPS) return;
    this.lastDrawAt = now;
    this.draw();
  }

  private segmentDue(now: number): void {
    const segmenter = this.segmentation.current();
    if (!segmenter) return;
    const slow = this.inferenceEma > SLOW_INFERENCE_MS;
    for (const s of this.sources) {
      if (s.inflight || !s.video.videoWidth || s.video.paused) continue;
      const interval = slow ? s.intervalMs * 2 : s.intervalMs;
      if (now - s.lastSegmentAt < interval) continue;
      if (s.video.currentTime === s.lastFrameTime) continue;
      s.lastFrameTime = s.video.currentTime;
      s.lastSegmentAt = now;
      s.inflight = true;
      const { width, height } = fitWithin(s.video.videoWidth, s.video.videoHeight, LIVE_PROBE_EDGE);
      const started = performance.now();
      segmenter
        .segment(s.video, width, height)
        .then((mask) => {
          const ms = performance.now() - started;
          this.inferenceEma = this.inferenceEma ? this.inferenceEma * 0.8 + ms * 0.2 : ms;
          s.maskCanvas = maskToCanvas(mask, s.maskCanvas ?? undefined);
          const b = mask.bbox;
          const next = b && s.mirrored ? { ...b, x: 1 - b.x - b.width } : b;
          if (!sameBox(next, s.bbox)) {
            s.bbox = next;
            this.maskVersion.update((n) => n + 1);
          }
        })
        .catch(() => undefined)
        .finally(() => (s.inflight = false));
    }
  }

  private draw(): void {
    const canvas = this.peopleRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scene = this.scene();
    const size: Size = { width: canvas.width, height: canvas.height };
    const layers: PersonLayer[] = this.presentSources().map((s) => ({
      role: s.role,
      image: s.video,
      mask: s.maskCanvas,
      placement: scene.people[s.role] ?? DEFAULT_PLACEMENTS[s.role],
      mirror: s.mirrored,
    }));

    if (this.canvasMode()) {
      // Pixelate and VHS cannot be CSS: draw the whole scene, then run the filter over it.
      const full = this.scratch.get('full', size.width, size.height);
      drawScene(full, { background: this.bgBitmap, surfaceColor: SCENE_SURFACE, fx: scene.fx, people: layers, front: scene.front }, this.scratch);
      this.engine.render(full, this.filter(), canvas);
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    drawPeople(ctx, size, layers, scene.front, this.scratch);
  }

  // ---- gestures -------------------------------------------------------------------

  protected onPointerDown(event: PointerEvent): void {
    if (!this.interactive()) return;
    const point = this.toScenePoint(event);
    const scene = this.scene();
    const people = this.presentSources().map((s) => ({
      role: s.role,
      placement: scene.people[s.role] ?? DEFAULT_PLACEMENTS[s.role],
      frame: videoSize(s.video),
      bbox: s.bbox,
    }));
    if (this.drag) {
      // Second finger: start a pinch on the person already being dragged.
      this.drag.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.drag.startDist = this.pointerDistance();
      this.drag.start = scene.people[this.drag.role] ?? DEFAULT_PLACEMENTS[this.drag.role];
      return;
    }
    const hit = hitTest(point, people, scene.front, this.sceneSize()) ?? (people.length ? scene.front : null);
    if (!hit) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = {
      pointers: new Map([[event.pointerId, { x: event.clientX, y: event.clientY }]]),
      role: hit,
      start: scene.people[hit] ?? DEFAULT_PLACEMENTS[hit],
      startDist: 0,
      origin: { x: event.clientX, y: event.clientY },
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || !drag.pointers.has(event.pointerId)) return;
    drag.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = this.sceneEl().nativeElement.getBoundingClientRect();
    if (drag.pointers.size >= 2 && drag.startDist > 0) {
      const factor = this.pointerDistance() / drag.startDist;
      this.emitPlacement(drag.role, { ...drag.start, scale: drag.start.scale * factor }, false);
      return;
    }
    const dx = (event.clientX - drag.origin.x) / rect.width;
    const dy = (event.clientY - drag.origin.y) / rect.height;
    this.emitPlacement(drag.role, { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy }, false);
  }

  protected onPointerEnd(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    drag.pointers.delete(event.pointerId);
    if (drag.pointers.size > 0) {
      // Back to a one-finger drag from the current position.
      const remaining = [...drag.pointers.values()][0];
      drag.origin = remaining;
      drag.start = this.scene().people[drag.role] ?? DEFAULT_PLACEMENTS[drag.role];
      drag.startDist = 0;
      return;
    }
    this.drag = null;
    const placement = this.scene().people[drag.role] ?? DEFAULT_PLACEMENTS[drag.role];
    this.placementCommit.emit({ role: drag.role, placement });
  }

  protected onWheel(event: WheelEvent): void {
    if (!this.interactive()) return;
    event.preventDefault();
    const scene = this.scene();
    const point = this.toScenePoint(event);
    const people = this.presentSources().map((s) => ({
      role: s.role,
      placement: scene.people[s.role] ?? DEFAULT_PLACEMENTS[s.role],
      frame: videoSize(s.video),
      bbox: s.bbox,
    }));
    const role = hitTest(point, people, scene.front, this.sceneSize()) ?? scene.front;
    const current = scene.people[role] ?? DEFAULT_PLACEMENTS[role];
    this.emitPlacement(role, { ...current, scale: current.scale * (1 - Math.sign(event.deltaY) * 0.05) }, true);
  }

  protected onHandleKey(event: KeyboardEvent, role: PersonRole): void {
    const current = this.scene().people[role] ?? DEFAULT_PLACEMENTS[role];
    const step = event.shiftKey ? KEY_NUDGE_LARGE : KEY_NUDGE;
    let next: Placement | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        next = { ...current, x: current.x - step };
        break;
      case 'ArrowRight':
        next = { ...current, x: current.x + step };
        break;
      case 'ArrowUp':
        next = { ...current, y: current.y - step };
        break;
      case 'ArrowDown':
        next = { ...current, y: current.y + step };
        break;
      case '+':
      case '=':
        next = { ...current, scale: current.scale * 1.05 };
        break;
      case '-':
        next = { ...current, scale: current.scale / 1.05 };
        break;
      case 'Enter':
        event.preventDefault();
        this.frontChange.emit(role);
        return;
      default:
        return;
    }
    event.preventDefault();
    this.emitPlacement(role, next, true);
  }

  private emitPlacement(role: PersonRole, placement: Placement, commit: boolean): void {
    const clamped = clampPlacement(placement);
    this.placementChange.emit({ role, placement: clamped });
    if (commit) this.placementCommit.emit({ role, placement: clamped });
  }

  private toScenePoint(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.sceneEl().nativeElement.getBoundingClientRect();
    const size = this.sceneSize();
    return { x: ((event.clientX - rect.left) / rect.width) * size.width, y: ((event.clientY - rect.top) / rect.height) * size.height };
  }

  private pointerDistance(): number {
    const pts = [...(this.drag?.pointers.values() ?? [])];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
}

function videoSize(video: HTMLVideoElement): Size {
  return { width: video.videoWidth || 4, height: video.videoHeight || 3 };
}

function sameBox(a: NormRect | null, b: NormRect | null): boolean {
  if (!a || !b) return a === b;
  const eps = 0.01;
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.width - b.width) < eps && Math.abs(a.height - b.height) < eps;
}

/** Exported for the room's fallback frame grab and tests. */
export const SCENE_ROLES = PERSON_ROLES;
