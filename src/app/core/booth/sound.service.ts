import { Injectable, inject } from '@angular/core';
import { ProfileService } from '../profile/profile.service';

/**
 * Tiny synthesised sounds so the booth ships no audio files. Everything respects the
 * user's sound preference, which is off by default, and nothing plays without a prior
 * user gesture because the AudioContext is created lazily.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly profile = inject(ProfileService);
  private context: AudioContext | null = null;

  tick(): void {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(ctx, 880, 0.06, 0.12);
  }

  shutter(): void {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(ctx, 1400, 0.03, 0.18, 'square');
    this.noise(ctx, 0.08, 0.22);
  }

  chime(): void {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(ctx, 660, 0.12, 0.12);
    this.tone(ctx, 990, 0.16, 0.12, 'sine', 0.1);
  }

  private ready(): AudioContext | null {
    if (!this.profile.soundEnabled()) return null;
    if (typeof AudioContext === 'undefined') return null;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  private tone(
    ctx: AudioContext,
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    delay = 0,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  private noise(ctx: AudioContext, duration: number, volume: number): void {
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }
}
