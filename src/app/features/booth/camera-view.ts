import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FrameGrabber, mirrorTransform } from '../../core/camera/frame-grabber';
import { FilterEngine, toCssFilter } from '../../core/filters/filter-engine';
import { needsCanvasPreview, type FilterDefinition } from '../../core/filters/filter.model';
import { ORIGINAL_FILTER } from '../../core/filters/presets';
import { createCanvas, fitWithin, type AnyCanvas } from '../../core/photo/image-encode';
import { FilterPreviewLayers } from '../filters/filter-preview-layers';
import { Spinner } from '../../shared/ui/spinner';

/** Frames per second for the canvas fallback preview (pixelate, vhs). */
const CANVAS_PREVIEW_FPS = 15;
const CANVAS_PREVIEW_EDGE = 540;

/**
 * Renders a MediaStream with the active filter. Normal filters are CSS on the video
 * plus blend layers, so no JavaScript runs per frame. A few effects CSS cannot express
 * fall back to a low-rate canvas loop that runs only while such a filter is selected.
 */
@Component({
  selector: 'app-camera-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spinner, FilterPreviewLayers],
  template: `
    <video
      #video
      autoplay
      playsinline
      [muted]="true"
      [class.mirrored]="mirrored()"
      [class.hidden]="canvasMode()"
      [style.filter]="canvasMode() ? null : cssFilter()"
      (loadedmetadata)="ready.set(true)"
      aria-label="Camera preview"
    ></video>
    @if (canvasMode()) {
      <canvas #fx class="fx" aria-hidden="true"></canvas>
    } @else {
      <app-filter-preview-layers [filter]="filter()" />
    }
    @if (!ready()) {
      <div class="loading"><app-spinner size="lg" label="Starting camera" /></div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      background: #000;
    }
    video,
    .fx {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    video.mirrored {
      transform: scaleX(-1);
    }
    video.hidden {
      opacity: 0;
    }
    .loading {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #fff;
    }
  `,
})
export class CameraView {
  readonly stream = input.required<MediaStream | null>();
  readonly mirrored = input(false);
  readonly filter = input<FilterDefinition>(ORIGINAL_FILTER);

  protected readonly ready = signal(false);
  protected readonly cssFilter = computed(() => toCssFilter(this.filter().adjustments));
  protected readonly canvasMode = computed(() => needsCanvasPreview(this.filter()));

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly fx = viewChild<ElementRef<HTMLCanvasElement>>('fx');
  private readonly engine = inject(FilterEngine);
  private readonly grabber = new FrameGrabber();
  private scratch: AnyCanvas | null = null;
  private loopHandle: number | null = null;

  constructor() {
    // Attach imperatively and call play(): autoplay alone is not reliable for live
    // streams across browsers, and a paused preview can never be captured.
    effect(() => {
      const el = this.video()?.nativeElement;
      const stream = this.stream();
      if (!el) return;
      this.ready.set(false);
      // Must be set before play(): template bindings apply after this effect runs,
      // and an unmuted play() is refused by autoplay policy.
      el.muted = true;
      el.playsInline = true;
      el.srcObject = stream;
      if (stream) el.play().catch(() => undefined);
    });

    effect(() => {
      const active = this.canvasMode() && !!this.fx();
      if (active) this.startLoop();
      else this.stopLoop();
    });

    inject(DestroyRef).onDestroy(() => {
      this.stopLoop();
      const el = this.video()?.nativeElement;
      if (el) el.srcObject = null;
      this.grabber.dispose();
      this.scratch = null;
    });
  }

  /** Full-resolution copy of the current, unfiltered frame, mirrored the way the user sees it. */
  grabFrame(maxLongEdge?: number): Promise<ImageBitmap> {
    const el = this.video()?.nativeElement;
    if (!el) return Promise.reject(new Error('camera view not ready'));
    return this.grabber.grab(el, { mirror: this.mirrored(), maxLongEdge });
  }

  private startLoop(): void {
    if (this.loopHandle !== null) return;
    let last = 0;
    const interval = 1000 / CANVAS_PREVIEW_FPS;
    const step = (now: number): void => {
      this.loopHandle = requestAnimationFrame(step);
      if (now - last < interval) return;
      last = now;
      this.drawCanvasPreview();
    };
    this.loopHandle = requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this.loopHandle !== null) cancelAnimationFrame(this.loopHandle);
    this.loopHandle = null;
  }

  private drawCanvasPreview(): void {
    const video = this.video()?.nativeElement;
    const fx = this.fx()?.nativeElement;
    if (!video || !fx || !video.videoWidth) return;

    const { width, height } = fitWithin(video.videoWidth, video.videoHeight, CANVAS_PREVIEW_EDGE);
    if (!this.scratch) this.scratch = createCanvas(width, height);
    if (this.scratch.width !== width) this.scratch.width = width;
    if (this.scratch.height !== height) this.scratch.height = height;

    const sctx = this.scratch.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    const { a, e } = mirrorTransform(width, this.mirrored());
    sctx.setTransform(a, 0, 0, 1, e, 0);
    sctx.drawImage(video, 0, 0, width, height);
    sctx.setTransform(1, 0, 0, 1, 0, 0);

    this.engine.render(this.scratch, this.filter(), fx);
  }
}
