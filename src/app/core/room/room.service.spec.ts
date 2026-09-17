import { Injector, signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { ProfileService } from '../profile/profile.service';
import {
  BroadcastChannelSignaling,
  HEARTBEAT_MS,
  PRESENCE_TIMEOUT_MS,
  type ChannelLike,
} from '../signaling/broadcast-channel-signaling';
import { SIGNALING_TRANSPORT } from '../signaling/signaling-transport';
import { RoomService } from './room.service';

/** In-memory stand-in for BroadcastChannel: same name = same bus, async delivery. */
class Hub {
  private readonly channels = new Map<string, Set<FakeChannel>>();
  create = (name: string): ChannelLike => {
    const ch = new FakeChannel(name, this);
    let set = this.channels.get(name);
    if (!set) this.channels.set(name, (set = new Set()));
    set.add(ch);
    return ch;
  };
  broadcast(from: FakeChannel, data: unknown): void {
    for (const ch of this.channels.get(from.name) ?? []) {
      if (ch !== from) queueMicrotask(() => ch.onmessage?.({ data }));
    }
  }
  remove(ch: FakeChannel): void {
    this.channels.get(ch.name)?.delete(ch);
  }
}

class FakeChannel implements ChannelLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(
    readonly name: string,
    private readonly hub: Hub,
  ) {}
  postMessage(data: unknown): void {
    this.hub.broadcast(this, data);
  }
  close(): void {
    this.hub.remove(this);
  }
}

function makeClient(hub: Hub, name: string): RoomService {
  const profile = { profile: signal({ name, emoji: '❤️', color: '#d98a9c' }) } as unknown as ProfileService;
  const injector = Injector.create({
    providers: [
      { provide: SIGNALING_TRANSPORT, useValue: new BroadcastChannelSignaling(hub.create, () => Date.now()) },
      { provide: ProfileService, useValue: profile },
      { provide: RoomService },
    ],
  });
  return injector.get(RoomService);
}

const flush = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe('RoomService over BroadcastChannelSignaling', () => {
  let hub: Hub;

  beforeEach(() => {
    vi.useFakeTimers();
    hub = new Hub();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('host waits alone, then both become connected when a guest joins', async () => {
    const host = makeClient(hub, 'Host');
    const guest = makeClient(hub, 'Guest');

    const code = await host.create();
    expect(code).toHaveLength(6);
    expect(host.status()).toBe('waiting');
    expect(host.isHost()).toBe(true);
    expect(host.partner()).toBeNull();

    // Lower-case input is accepted; with the in-memory hub the handshake completes in microtasks.
    await guest.join(code.toLowerCase());
    await flush(10);

    expect(host.status()).toBe('connected');
    expect(guest.status()).toBe('connected');
    expect(host.partner()?.name).toBe('Guest');
    expect(guest.partner()?.name).toBe('Host');
    expect(guest.room()?.hostId).toBe(host.self()?.id);
    expect(host.lastEvent()).toBe('partner-joined');
  });

  it('guest leaving moves the host to disconnected and keeps the room open', async () => {
    const host = makeClient(hub, 'Host');
    const guest = makeClient(hub, 'Guest');
    const code = await host.create();
    await guest.join(code);
    await flush(10);

    await guest.leave();
    await flush(10);
    expect(host.status()).toBe('disconnected');
    expect(host.lastEvent()).toBe('partner-left');
    expect(host.inRoom()).toBe(true);

    const again = makeClient(hub, 'Again');
    await again.join(code);
    await flush(10);
    expect(host.status()).toBe('connected');
    expect(again.status()).toBe('connected');
  });

  it('host leaving ends the room for the guest', async () => {
    const host = makeClient(hub, 'Host');
    const guest = makeClient(hub, 'Guest');
    const code = await host.create();
    await guest.join(code);
    await flush(10);

    await host.leave();
    await flush(10);
    expect(guest.status()).toBe('ended');
    expect(guest.error()?.code).toBe('room-ended');
    expect(guest.inRoom()).toBe(false);
  });

  it('a silent host (no bye) is noticed via the presence timeout', async () => {
    const host = makeClient(hub, 'Host');
    const guest = makeClient(hub, 'Guest');
    const code = await host.create();
    await guest.join(code);
    await flush(10);

    // Simulate a crashed tab: the host's channel just stops talking.
    const transport = (host as unknown as { transport: BroadcastChannelSignaling }).transport;
    (transport as unknown as { channel: ChannelLike }).channel.postMessage = () => undefined;
    await flush(PRESENCE_TIMEOUT_MS + HEARTBEAT_MS * 2);
    expect(guest.status()).toBe('ended');
  });

  it('a third person is told the room is full', async () => {
    const host = makeClient(hub, 'Host');
    const guest = makeClient(hub, 'Guest');
    const third = makeClient(hub, 'Third');
    const code = await host.create();
    await guest.join(code);
    await flush(10);
    await third.join(code);
    await flush(20);

    expect(third.status()).toBe('full');
    expect(third.error()?.code).toBe('room-full');
    expect(host.status()).toBe('connected');
    expect(guest.status()).toBe('connected');
    expect(host.partner()?.name).toBe('Guest');
  });

  it('joining a code nobody hosts reports not-found after the lookup window', async () => {
    const guest = makeClient(hub, 'Guest');
    await guest.join('ABCDEF');
    expect(guest.status()).toBe('looking');
    await flush(environment.room.joinLookupTimeoutMs + 50);
    expect(guest.status()).toBe('not-found');
    expect(guest.error()?.code).toBe('room-not-found');
  });

  it('rejects malformed codes immediately', async () => {
    const guest = makeClient(hub, 'Guest');
    await guest.join('nope');
    expect(guest.status()).toBe('not-found');
    expect(guest.error()?.code).toBe('invalid-room-code');
  });

  it('a host alone past the idle timeout ends the room', async () => {
    const host = makeClient(hub, 'Host');
    await host.create();
    await flush(environment.room.hostIdleTimeoutMs + 50);
    expect(host.status()).toBe('ended');
    expect(host.room()).toBeNull();
  });

  it('reset returns to idle so the UI can start again', async () => {
    const guest = makeClient(hub, 'Guest');
    await guest.join('nope');
    guest.reset();
    expect(guest.status()).toBe('idle');
    expect(guest.error()).toBeNull();
  });
});
