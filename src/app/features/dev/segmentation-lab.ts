import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { CameraService } from '../../core/camera/camera.service';
import { fitWithin } from '../../core/photo/image-encode';
import { maskToCanvas } from '../../core/segmentation/mask-encode';
import { SegmentationService } from '../../core/segmentation/segmentation.service';
import { LIVE_PROBE_EDGE, type Mask, type PersonSegmenter } from '../../core/segmentation/segmenter';
import { Button } from '../../shared/ui/button';

/**
 * Development-only page (`/dev/segmentation`): shows the live cutout the on-device model
 * produces, with timings. Not part of the production bundle's routes.
 */
@Component({
  selector: 'app-segmentation-lab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `
    <div class="lab">
      <h1>Segmentation lab</h1>
      <p class="stats" data-testid="stats">
        status: <b>{{ seg.status() }}</b> · engine: <b>{{ seg.kind() ?? '–' }}</b> · load: <b>{{ seg.loadMs() ?? '–' }} ms</b> ·
        infer: <b data-testid="infer-ms">{{ inferMs() }}</b> ms · fps: <b data-testid="fps">{{ fps() }}</b> · probe:
        <b data-testid="probe">{{ probe() }}</b> · bbox: <b data-testid="bbox">{{ bbox() }}</b>
      </p>
      <div class="row">
        <button appButton size="sm" (click)="view.set('cutout')" [attr.aria-pressed]="view() === 'cutout'">Cutout</button>
        <button appButton size="sm" (click)="view.set('mask')" [attr.aria-pressed]="view() === 'mask'">Mask</button>
        <button appButton size="sm" variant="secondary" (click)="camera.flip()">Flip</button>
      </div>
      <div class="stage">
        <video #video playsinline muted autoplay></video>
        <canvas #out data-testid="out"></canvas>
      </div>
      @if (camera.error(); as err) {
        <p>{{ err.userMessage.message }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: #000;
      color: #eee;
      padding: var(--space-4);
      font-family: var(--font-ui);
    }
    h1 {
      font-size: var(--text-lg);
      margin: 0 0 var(--space-2);
    }
    .stats {
      font-size: var(--text-xs);
      color: #bbb;
      margin: 0 0 var(--space-3);
    }
    .row {
      display: flex;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }
    .stage {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }
    video,
    canvas {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: contain;
      background: #111;
      border-radius: var(--radius-md);
    }
  `,
})
export class SegmentationLab {
  protected readonly camera = inject(CameraService);
  protected readonly seg = inject(SegmentationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly outRef = viewChild.required<ElementRef<HTMLCanvasElement>>('out');

  protected readonly view = signal<'cutout' | 'mask'>('cutout');
  protected readonly inferMs = signal('–');
  protected readonly fps = signal('–');
  protected readonly probe = signal('–');
  protected readonly bbox = signal('–');

  private frame = 0;
  private running = true;
  private busy = false;
  private emaMs = 0;
  private frames = 0;
  private fpsWindowStart = performance.now();
  private maskCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;

  constructor() {
    void this.camera.start({ audio: false });
    this.seg.prewarm();

    effect(() => {
      const el = this.videoRef().nativeElement;
      const stream = this.camera.stream();
      el.muted = true;
      el.playsInline = true;
      el.srcObject = stream;
      if (stream) void el.play().catch(() => undefined);
    });

    this.frame = requestAnimationFrame(() => this.tick());
    this.destroyRef.onDestroy(() => {
      this.running = false;
      cancelAnimationFrame(this.frame);
      this.camera.stop();
    });
  }

  private tick(): void {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => this.tick());
    const segmenter = this.seg.current();
    const video = this.videoRef().nativeElement;
    if (!segmenter || this.busy || !video.videoWidth) return;
    this.busy = true;
    const { width, height } = fitWithin(video.videoWidth, video.videoHeight, LIVE_PROBE_EDGE);
    const t0 = performance.now();
    segmenter
      .segment(video, width, height)
      .then((mask) => {
        const ms = performance.now() - t0;
        this.emaMs = this.emaMs ? this.emaMs * 0.8 + ms * 0.2 : ms;
        this.inferMs.set(this.emaMs.toFixed(1));
        this.probe.set(`${width}×${height}`);
        this.bbox.set(mask.bbox ? `${mask.bbox.x.toFixed(2)},${mask.bbox.y.toFixed(2)} ${mask.bbox.width.toFixed(2)}×${mask.bbox.height.toFixed(2)}` : 'none');
        this.draw(video, mask, segmenter);
        this.countFrame();
      })
      .catch(() => undefined)
      .finally(() => (this.busy = false));
  }

  private countFrame(): void {
    this.frames++;
    const now = performance.now();
    if (now - this.fpsWindowStart >= 1000) {
      this.fps.set(String(Math.round((this.frames * 1000) / (now - this.fpsWindowStart))));
      this.frames = 0;
      this.fpsWindowStart = now;
    }
  }

  private draw(video: HTMLVideoElement, mask: Mask, _segmenter: PersonSegmenter): void {
    const out = this.outRef().nativeElement;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (out.width !== w || out.height !== h) {
      out.width = w;
      out.height = h;
    }
    const ctx = out.getContext('2d');
    if (!ctx) return;
    this.maskCanvas = maskToCanvas(mask, this.maskCanvas ?? undefined);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (this.camera.mirrored()) ctx.setTransform(-1, 0, 0, 1, w, 0);
    if (this.view() === 'mask') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(this.maskCanvas, 0, 0, w, h);
    } else {
      ctx.drawImage(video, 0, 0, w, h);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(this.maskCanvas, 0, 0, w, h);
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
}
