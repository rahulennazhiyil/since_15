import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { Subject, Subscription, filter, map, type Observable } from 'rxjs';
import { RoomService } from '../../core/room/room.service';
import type { BoothMessage } from '../../core/webrtc/booth-messages';
import { PeerConnectionService } from '../../core/webrtc/peer-connection.service';
import type { ActivityId } from './activity.model';

/** Sent by a side that just opened an activity; the other side answers with current state. */
export interface AskPayload {
  ask: true;
}

export const isAsk = (v: unknown): v is AskPayload => (v as AskPayload)?.ask === true;

/**
 * Peer-to-peer messaging for activities. Follows the current data channel as
 * connections come and go; without a partner, sends are no-ops and streams are silent.
 *
 * Messages are relayed through one service-level subject so an activity that subscribes
 * in its constructor hears everything from that instant, with no scheduling gap.
 */
@Injectable({ providedIn: 'root' })
export class ActivityChannel {
  private readonly peer = inject(PeerConnectionService);
  private readonly room = inject(RoomService);
  private readonly relay = new Subject<BoothMessage>();
  private busSubscription: Subscription | null = null;

  /** True when a partner can hear us. */
  readonly connected = computed(() => this.peer.channelOpen());
  /** The host answers state requests, so two simultaneous openers converge. */
  readonly isHost = computed(() => this.room.isHost());

  constructor() {
    effect(() => {
      const bus = this.peer.bus();
      untracked(() => {
        this.busSubscription?.unsubscribe();
        this.busSubscription = bus ? bus.messages$.subscribe((m) => this.relay.next(m)) : null;
      });
    });
  }

  send(activity: ActivityId, payload: unknown): boolean {
    return this.peer.bus()?.send({ type: 'activity', activity, payload }) ?? false;
  }

  on<T>(activity: ActivityId, validate: (payload: unknown) => payload is T): Observable<T> {
    return this.relay.pipe(
      filter((m) => m.type === 'activity' && m.activity === activity),
      map((m) => (m as { payload: unknown }).payload),
      filter(validate),
    );
  }

  /**
   * Asks the partner for the activity's current state now and whenever the channel
   * (re)opens. Call from an activity's constructor (injection context).
   */
  requestStateOnConnect(activity: ActivityId): void {
    effect(() => {
      if (this.connected()) untracked(() => this.send(activity, { ask: true } satisfies AskPayload));
    });
  }
}
