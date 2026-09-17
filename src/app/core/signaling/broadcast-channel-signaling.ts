import { BehaviorSubject, Subject, type Observable } from 'rxjs';
import type { PresenceInfo, SignalMessage, SignalingStatus, SignalingTransport } from './signaling-transport';

type Envelope =
  | { kind: 'hello'; presence: PresenceInfo }
  | { kind: 'heartbeat'; presence: PresenceInfo }
  | { kind: 'bye'; id: string }
  | { kind: 'signal'; message: SignalMessage };

/** Minimal surface of BroadcastChannel so tests can substitute an in-memory hub. */
export interface ChannelLike {
  postMessage(data: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export type ChannelFactory = (name: string) => ChannelLike;

export const HEARTBEAT_MS = 1000;
export const PRESENCE_TIMEOUT_MS = 3500;

/**
 * Development and E2E transport: every tab of the same browser on the same room code
 * shares a BroadcastChannel. Presence is emulated with heartbeats. Zero network.
 */
export class BroadcastChannelSignaling implements SignalingTransport {
  private readonly presence = new BehaviorSubject<PresenceInfo[]>([]);
  private readonly messages = new Subject<SignalMessage>();
  private readonly status = new BehaviorSubject<SignalingStatus>('idle');

  readonly presence$: Observable<PresenceInfo[]> = this.presence.asObservable();
  readonly messages$: Observable<SignalMessage> = this.messages.asObservable();
  readonly status$: Observable<SignalingStatus> = this.status.asObservable();

  private channel: ChannelLike | null = null;
  private self: PresenceInfo | null = null;
  private readonly peers = new Map<string, { info: PresenceInfo; seenAt: number }>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(
    // BroadcastChannel's onmessage is typed against MessageEvent; structurally it fits.
    private readonly createChannel: ChannelFactory = (name) => new BroadcastChannel(name) as unknown as ChannelLike,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async join(roomCode: string, self: PresenceInfo): Promise<void> {
    await this.leave();
    this.status.next('connecting');
    this.self = self;
    this.channel = this.createChannel(`since060815:room:${roomCode}`);
    this.channel.onmessage = (event) => this.receive(event.data as Envelope);
    this.post({ kind: 'hello', presence: self });
    this.heartbeat = setInterval(() => this.tick(), HEARTBEAT_MS);
    this.status.next('open');
    this.publish();
  }

  async leave(): Promise<void> {
    if (!this.channel) return;
    if (this.self) this.post({ kind: 'bye', id: this.self.id });
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.channel.onmessage = null;
    this.channel.close();
    this.channel = null;
    this.self = null;
    this.peers.clear();
    this.presence.next([]);
    this.status.next('closed');
  }

  async send(message: SignalMessage): Promise<void> {
    if (!this.channel) throw new Error('not joined');
    this.post({ kind: 'signal', message });
  }

  private post(envelope: Envelope): void {
    this.channel?.postMessage(envelope);
  }

  private receive(envelope: Envelope): void {
    if (!this.self) return;
    switch (envelope.kind) {
      case 'hello':
        this.remember(envelope.presence);
        // Answer straight away so the newcomer sees us without waiting for a heartbeat.
        this.post({ kind: 'heartbeat', presence: this.self });
        break;
      case 'heartbeat':
        this.remember(envelope.presence);
        break;
      case 'bye':
        if (this.peers.delete(envelope.id)) this.publish();
        break;
      case 'signal': {
        const m = envelope.message;
        if (m.from === this.self.id) return;
        if ('to' in m && m.to !== this.self.id) return;
        this.messages.next(m);
        break;
      }
    }
  }

  private remember(info: PresenceInfo): void {
    if (!this.self || info.id === this.self.id) return;
    const known = this.peers.has(info.id);
    this.peers.set(info.id, { info, seenAt: this.now() });
    if (!known) this.publish();
  }

  private tick(): void {
    if (!this.self) return;
    this.post({ kind: 'heartbeat', presence: this.self });
    const cutoff = this.now() - PRESENCE_TIMEOUT_MS;
    let changed = false;
    for (const [id, peer] of this.peers) {
      if (peer.seenAt < cutoff) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) this.publish();
  }

  private publish(): void {
    if (!this.self) return;
    const all = [this.self, ...Array.from(this.peers.values(), (p) => p.info)];
    all.sort((a, b) => a.joinedAt - b.joinedAt);
    this.presence.next(all);
  }
}
