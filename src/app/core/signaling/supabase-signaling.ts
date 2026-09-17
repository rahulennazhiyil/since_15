import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject, Subject, type Observable } from 'rxjs';
import type { PresenceInfo, SignalMessage, SignalingStatus, SignalingTransport } from './signaling-transport';

const SIGNAL_EVENT = 'signal';

/**
 * Production transport: one Supabase Realtime channel per room. Broadcast carries the
 * connection set-up messages; Presence carries who is here. No tables, no storage: the
 * channel exists only while someone is subscribed to it.
 */
export class SupabaseSignaling implements SignalingTransport {
  private readonly presence = new BehaviorSubject<PresenceInfo[]>([]);
  private readonly messages = new Subject<SignalMessage>();
  private readonly status = new BehaviorSubject<SignalingStatus>('idle');

  readonly presence$: Observable<PresenceInfo[]> = this.presence.asObservable();
  readonly messages$: Observable<SignalMessage> = this.messages.asObservable();
  readonly status$: Observable<SignalingStatus> = this.status.asObservable();

  private readonly client: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private self: PresenceInfo | null = null;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }

  async join(roomCode: string, self: PresenceInfo): Promise<void> {
    await this.leave();
    this.self = self;
    this.status.next('connecting');

    const channel = this.client.channel(`room:${roomCode}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: self.id } },
    });
    this.channel = channel;

    channel.on('broadcast', { event: SIGNAL_EVENT }, ({ payload }) => {
      const m = payload as SignalMessage;
      if (!m || typeof m.type !== 'string' || m.from === self.id) return;
      if ('to' in m && m.to !== self.id) return;
      this.messages.next(m);
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceInfo>();
      const all: PresenceInfo[] = Object.values(state)
        .flat()
        .filter((p) => !!p && typeof p.id === 'string')
        .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color, role: p.role, joinedAt: p.joinedAt }))
        .sort((a, b) => a.joinedAt - b.joinedAt);
      this.presence.next(all);
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          this.status.next('open');
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.status.next('error');
          reject(error ?? new Error(status));
        } else if (status === 'CLOSED') {
          this.status.next('closed');
        }
      });
    });

    await channel.track(self);
  }

  async leave(): Promise<void> {
    const channel = this.channel;
    this.channel = null;
    this.self = null;
    if (channel) {
      try {
        await channel.untrack();
      } catch {
        // Already gone.
      }
      await this.client.removeChannel(channel);
    }
    this.presence.next([]);
    this.status.next('closed');
  }

  async send(message: SignalMessage): Promise<void> {
    if (!this.channel) throw new Error('not joined');
    await this.channel.send({ type: 'broadcast', event: SIGNAL_EVENT, payload: message });
  }
}
