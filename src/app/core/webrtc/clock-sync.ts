import { filter, firstValueFrom, timeout } from 'rxjs';
import type { DataChannelBus } from './data-channel';

export interface ClockSample {
  /** Local time the ping left. */
  sentAt: number;
  /** Local time the pong arrived. */
  returnedAt: number;
  /** Remote time the ping was received. */
  remoteAt: number;
}

export interface ClockEstimate {
  /** remoteClock - localClock, in ms. Add to a local time to express it in remote time. */
  offset: number;
  /** Round trip of the best sample, in ms. */
  rtt: number;
  samples: number;
}

/** NTP-style: offset = remote - (send + rtt/2); take the median to shrug off jitter. */
export function estimateOffset(samples: ClockSample[]): ClockEstimate {
  if (samples.length === 0) return { offset: 0, rtt: 0, samples: 0 };
  const offsets = samples.map((s) => {
    const rtt = s.returnedAt - s.sentAt;
    return { offset: s.remoteAt - (s.sentAt + rtt / 2), rtt };
  });
  offsets.sort((a, b) => a.offset - b.offset);
  const mid = Math.floor(offsets.length / 2);
  const median = offsets.length % 2 ? offsets[mid].offset : (offsets[mid - 1].offset + offsets[mid].offset) / 2;
  const rtt = Math.min(...offsets.map((o) => o.rtt));
  return { offset: median, rtt, samples: samples.length };
}

const PING_TIMEOUT_MS = 2000;

/**
 * Measures the clock offset to the peer over the data channel. The host is the
 * reference clock: it never applies an offset; the guest converts host times to local.
 */
export class ClockSync {
  private nextId = 1;

  constructor(
    private readonly bus: DataChannelBus,
    private readonly now: () => number = () => performance.timeOrigin + performance.now(),
  ) {}

  /** Answers pings; call once per bus on both sides. Returns an unsubscribe function. */
  serve(): () => void {
    const sub = this.bus.messages$.subscribe((m) => {
      if (m.type === 'ping') this.bus.send({ type: 'pong', id: m.id, sentAt: m.sentAt, receivedAt: this.now() });
    });
    return () => sub.unsubscribe();
  }

  async measure(rounds = 5, spacingMs = 120): Promise<ClockEstimate> {
    const samples: ClockSample[] = [];
    for (let i = 0; i < rounds; i++) {
      const sample = await this.ping().catch(() => null);
      if (sample) samples.push(sample);
      if (i < rounds - 1) await new Promise((r) => setTimeout(r, spacingMs));
    }
    return estimateOffset(samples);
  }

  private async ping(): Promise<ClockSample> {
    if (!this.bus.isOpen) throw new Error('channel closed');
    const id = this.nextId++;
    const sentAt = this.now();
    const reply = firstValueFrom(
      this.bus.messages$.pipe(
        filter((m) => m.type === 'pong' && m.id === id),
        timeout(PING_TIMEOUT_MS),
      ),
    );
    // If the channel closes before a pong arrives this rejects; never let that go unhandled.
    reply.catch(() => undefined);
    if (!this.bus.send({ type: 'ping', id, sentAt })) throw new Error('channel closed');
    const pong = (await reply) as Extract<BoothMessageOf<'pong'>, { type: 'pong' }>;
    return { sentAt, returnedAt: this.now(), remoteAt: pong.receivedAt };
  }
}

type BoothMessageOf<T extends string> = Extract<import('./booth-messages').BoothMessage, { type: T }>;
