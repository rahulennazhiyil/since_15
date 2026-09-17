import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { CameraService } from '../../core/camera/camera.service';
import { RoomService } from '../../core/room/room.service';
import { ClockSync } from '../../core/webrtc/clock-sync';
import type { DataChannelBus } from '../../core/webrtc/data-channel';
import { PeerConnectionService } from '../../core/webrtc/peer-connection.service';

const CLOCK_RESYNC_MS = 60_000;

/**
 * Glue between room presence, the local camera and the peer connection. Provided by the
 * room page so it lives exactly as long as the room screen does.
 *
 * - partner present + camera live  -> open the peer connection
 * - partner gone                    -> close it
 * - camera stream swapped (flip)    -> replace outgoing tracks
 * - data channel open               -> exchange mic state, sync clocks (guest to host)
 */
@Injectable()
export class RoomMediaService {
  private readonly room = inject(RoomService);
  private readonly camera = inject(CameraService);
  readonly peer = inject(PeerConnectionService);

  /** Host clock minus local clock, in ms. Zero on the host. */
  readonly clockOffset = signal(0);
  readonly clockRtt = signal(0);
  readonly partnerMicOn = signal(true);

  private activePeerId: string | null = null;
  private busSubscription: Subscription | null = null;
  private stopServing: (() => void) | null = null;
  private resyncTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const status = this.room.status();
      const partner = this.room.partner();
      const self = this.room.self();
      const live = this.camera.isLive();
      const stream = this.camera.stream();
      untracked(() => {
        const ready = status === 'connected' && partner && self && live;
        if (ready && partner.id !== this.activePeerId) {
          this.activePeerId = partner.id;
          this.peer.start({ selfId: self.id, peerId: partner.id, polite: !this.room.isHost(), localStream: stream });
        } else if (!ready && this.activePeerId) {
          this.activePeerId = null;
          this.peer.close();
        }
      });
    });

    effect(() => {
      const stream = this.camera.stream();
      untracked(() => {
        if (this.activePeerId) void this.peer.replaceLocalStream(stream);
      });
    });

    effect(() => {
      const bus = this.peer.bus();
      const open = this.peer.channelOpen();
      untracked(() => this.onBus(open ? bus : null));
    });

    effect(() => {
      const enabled = this.camera.micEnabled();
      untracked(() => this.peer.bus()?.send({ type: 'mic', enabled }));
    });

    inject(DestroyRef).onDestroy(() => {
      this.onBus(null);
      this.activePeerId = null;
      this.peer.close();
    });
  }

  /** Converts a time on the host's clock to this device's clock. */
  toLocalTime(hostTime: number): number {
    return hostTime - this.clockOffset();
  }

  toHostTime(localTime: number): number {
    return localTime + this.clockOffset();
  }

  private onBus(bus: DataChannelBus | null): void {
    this.busSubscription?.unsubscribe();
    this.busSubscription = null;
    this.stopServing?.();
    this.stopServing = null;
    if (this.resyncTimer) clearInterval(this.resyncTimer);
    this.resyncTimer = null;
    if (!bus) return;

    const sync = new ClockSync(bus);
    this.stopServing = sync.serve();
    this.busSubscription = bus.messages$.subscribe((m) => {
      if (m.type === 'mic') this.partnerMicOn.set(m.enabled);
    });
    bus.send({ type: 'mic', enabled: this.camera.micEnabled() });

    if (!this.room.isHost()) {
      const measure = (): void => {
        void sync.measure().then((e) => {
          if (e.samples > 0) {
            this.clockOffset.set(e.offset);
            this.clockRtt.set(e.rtt);
          }
        });
      };
      measure();
      this.resyncTimer = setInterval(measure, CLOCK_RESYNC_MS);
    }
  }
}
