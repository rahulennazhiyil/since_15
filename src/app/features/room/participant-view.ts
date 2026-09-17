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
  viewChild,
} from '@angular/core';
import { FrameGrabber } from '../../core/camera/frame-grabber';
import { ERROR_COPY } from '../../core/errors/error-copy';
import type { Participant } from '../../core/room/room.model';
import type { PeerState } from '../../core/webrtc/peer-connection.service';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Spinner } from '../../shared/ui/spinner';

/** The partner's tile: their video with a name chip, mic state and connection overlays. */
@Component({
  selector: 'app-participant-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon, Spinner],
  host: { '[class.away]': "state() === 'closed' || state() === 'idle'" },
  template: `
    <video #video autoplay playsinline (loadedmetadata)="ready.set(true)" [attr.aria-label]="participant().name + ' video'"></video>

    @if (!showVideo()) {
      <div class="overlay">
        <span class="avatar" [style.--c]="participant().color">{{ participant().emoji }}</span>
        <strong>{{ participant().name }}</strong>
        @switch (state()) {
          @case ('failed') {
            <p class="small">{{ failedCopy.message }}</p>
            <button appButton size="sm" variant="secondary" (click)="retry.emit()">{{ failedCopy.action }}</button>
          }
          @case ('disconnected') {
            <app-spinner size="sm" />
            <p class="small">Connection interrupted. Trying again…</p>
          }
          @default {
            <app-spinner size="sm" />
            <p class="small">Connecting…</p>
          }
        }
      </div>
    }

    <div class="chip" aria-hidden="true">
      <span class="emoji">{{ participant().emoji }}</span>
      <span>{{ participant().name }}</span>
      @if (!micOn()) {
        <app-icon name="mic-off" [size]="14" />
      }
    </div>
    @if (!micOn()) {
      <span class="visually-hidden">{{ participant().name }} has their microphone off</span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      background: #1c1a22;
      color: #fff;
    }
    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      align-content: center;
      gap: var(--space-2);
      text-align: center;
      padding: var(--space-4);
      background: #1c1a22;
      animation: fade-in var(--dur-base) var(--ease-out) both;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 4rem;
      height: 4rem;
      border-radius: 50%;
      font-size: 2rem;
      background: color-mix(in srgb, var(--c) 22%, #1c1a22);
      border: 2px solid color-mix(in srgb, var(--c) 70%, transparent);
    }
    .overlay .small {
      color: rgb(255 255 255 / 0.7);
    }
    .chip {
      position: absolute;
      left: var(--space-3);
      bottom: var(--space-3);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px 4px 6px;
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 0.45);
      font-size: var(--text-xs);
      font-weight: 700;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .chip app-icon {
      color: #f0c060;
    }
  `,
})
export class ParticipantView {
  readonly participant = input.required<Participant>();
  readonly stream = input<MediaStream | null>(null);
  readonly state = input<PeerState>('idle');
  readonly micOn = input(true);
  readonly retry = output<void>();

  protected readonly ready = signal(false);
  protected readonly failedCopy = ERROR_COPY['connection-failed'];
  protected readonly showVideo = computed(() => this.ready() && this.stream() !== null && this.state() === 'connected');

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly grabber = new FrameGrabber();

  /**
   * Fallback frame from the partner's video when their full-quality frame does not arrive.
   * Mirrored, because that is how they captured their own.
   */
  grabFrame(maxLongEdge?: number): Promise<ImageBitmap> {
    const el = this.video()?.nativeElement;
    if (!el) return Promise.reject(new Error('partner view not ready'));
    return this.grabber.grab(el, { mirror: true, maxLongEdge });
  }

  constructor() {
    effect(() => {
      const el = this.video()?.nativeElement;
      const stream = this.stream();
      if (!el) return;
      this.ready.set(false);
      el.playsInline = true;
      el.srcObject = stream;
      if (stream) el.play().catch(() => undefined);
    });
    inject(DestroyRef).onDestroy(() => {
      const el = this.video()?.nativeElement;
      if (el) el.srcObject = null;
      this.grabber.dispose();
    });
  }
}
