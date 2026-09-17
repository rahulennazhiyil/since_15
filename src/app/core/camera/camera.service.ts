import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import {
  requestCameraStream,
  stopTracks,
  type FacingMode,
} from '../permissions/media-permissions';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error';

interface StartOptions {
  audio?: boolean;
}

/**
 * Owns the single active camera stream for the whole app. Only one component at a time
 * should call start(); everyone else reads the signals.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly document = inject(DOCUMENT);

  private readonly _stream = signal<MediaStream | null>(null);
  private readonly _status = signal<CameraStatus>('idle');
  private readonly _error = signal<AppError | null>(null);
  private readonly _facing = signal<FacingMode>('user');
  private readonly _videoInputs = signal(0);
  private readonly _audioDenied = signal(false);
  private readonly _micEnabled = signal(true);

  private lastOptions: Required<StartOptions> | null = null;
  private interrupted = false;
  private listening = false;

  readonly stream = this._stream.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly facing = this._facing.asReadonly();
  readonly audioDenied = this._audioDenied.asReadonly();
  readonly micEnabled = this._micEnabled.asReadonly();

  readonly isLive = computed(() => this._status() === 'live' && this._stream() !== null);
  readonly canFlip = computed(() => this._videoInputs() > 1);
  /** Front cameras are shown mirrored, like a mirror, and captured the same way. */
  readonly mirrored = computed(() => this._facing() === 'user');
  readonly hasAudio = computed(() => (this._stream()?.getAudioTracks().length ?? 0) > 0);

  async start(options: StartOptions = {}): Promise<boolean> {
    if (this._status() === 'starting') return false;
    if (this.isLive() && this.lastOptions?.audio === !!options.audio) return true;

    this._status.set('starting');
    this._error.set(null);
    this.lastOptions = { audio: !!options.audio };

    try {
      // Count cameras before opening one: device kinds are visible pre-permission in
      // most browsers, and it avoids touching the device list while a stream is live.
      await this.refreshDeviceCount();
      const result = await requestCameraStream({ facing: this._facing(), audio: this.lastOptions.audio });
      this.adopt(result.stream);
      this._audioDenied.set(result.audioDenied);
      // Browsers that hide devices until permission is granted need a second look.
      if (this._videoInputs() === 0) await this.refreshDeviceCount();
      this._status.set('live');
      return true;
    } catch (error) {
      this._error.set(toAppError(error));
      this._status.set('error');
      return false;
    }
  }

  /** Switches between front and back cameras without a gap in the preview. */
  async flip(): Promise<void> {
    if (!this.isLive() || !this.canFlip() || !this.lastOptions) return;
    const next: FacingMode = this._facing() === 'user' ? 'environment' : 'user';
    const previous = this._stream();
    try {
      // Some phones refuse a second camera while the first is open; release it first.
      stopTracks(previous);
      const result = await requestCameraStream({ facing: next, audio: this.lastOptions.audio });
      this._facing.set(next);
      this.adopt(result.stream);
      this._audioDenied.set(result.audioDenied);
    } catch (error) {
      // Try to get the original camera back so the user is not left with nothing.
      this._error.set(toAppError(error));
      try {
        const result = await requestCameraStream({ facing: this._facing(), audio: this.lastOptions.audio });
        this.adopt(result.stream);
      } catch {
        this._stream.set(null);
        this._status.set('error');
      }
    }
  }

  setMicEnabled(enabled: boolean): void {
    this._micEnabled.set(enabled);
    this._stream()?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  stop(): void {
    stopTracks(this._stream());
    this._stream.set(null);
    this._status.set('idle');
    this._error.set(null);
    this.interrupted = false;
    this.lastOptions = null;
    this.stopListening();
  }

  private adopt(stream: MediaStream): void {
    stream.getAudioTracks().forEach((t) => (t.enabled = this._micEnabled()));
    const [video] = stream.getVideoTracks();
    if (video) {
      video.addEventListener('ended', () => this.onTrackEnded(stream), { once: true });
    }
    this._stream.set(stream);
    this.startListening();
  }

  /** iOS ends camera tracks when the tab is backgrounded; we restart when it returns. */
  private onTrackEnded(stream: MediaStream): void {
    if (this._stream() !== stream) return;
    this.interrupted = true;
    stopTracks(stream);
    this._stream.set(null);
    this._status.set('idle');
  }

  private readonly onVisibility = (): void => {
    if (this.document.visibilityState === 'visible' && this.interrupted && this.lastOptions) {
      this.interrupted = false;
      void this.start(this.lastOptions);
    }
  };

  private startListening(): void {
    if (this.listening) return;
    this.document.addEventListener('visibilitychange', this.onVisibility);
    this.listening = true;
  }

  private stopListening(): void {
    if (!this.listening) return;
    this.document.removeEventListener('visibilitychange', this.onVisibility);
    this.listening = false;
  }

  private async refreshDeviceCount(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this._videoInputs.set(devices.filter((d) => d.kind === 'videoinput').length);
    } catch {
      this._videoInputs.set(1);
    }
  }
}
