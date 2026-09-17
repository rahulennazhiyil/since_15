import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

export type ParticipantRole = 'host' | 'guest';

/** What each participant announces about themselves. Nothing more leaves the device. */
export interface PresenceInfo {
  id: string;
  name: string;
  emoji: string;
  color: string;
  role: ParticipantRole;
  joinedAt: number;
}

export type SignalMessage =
  | { type: 'offer' | 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  /** "My peer connection is listening now"; lets the other side re-offer if it started first. */
  | { type: 'peer-ready'; from: string; to: string }
  | { type: 'room-full'; from: string; to: string }
  | { type: 'room-ended'; from: string };

export type SignalingStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

/**
 * The only thing a room needs from the network: who is here, and a way to pass
 * connection set-up messages. Everything else travels peer-to-peer.
 */
export interface SignalingTransport {
  /** Everyone currently in the room, including this client. Emits on every change. */
  readonly presence$: Observable<PresenceInfo[]>;
  /** Messages addressed to this client or to everyone. */
  readonly messages$: Observable<SignalMessage>;
  readonly status$: Observable<SignalingStatus>;

  join(roomCode: string, self: PresenceInfo): Promise<void>;
  leave(): Promise<void>;
  send(message: SignalMessage): Promise<void>;
}

export const SIGNALING_TRANSPORT = new InjectionToken<SignalingTransport>('SIGNALING_TRANSPORT');
