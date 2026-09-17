import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { BoothMessage } from '../webrtc/booth-messages';
import type { DataChannelBus } from '../webrtc/data-channel';
import { CaptureCoordinator, type CaptureSchedule } from './capture-coordinator';

/** Two fake buses wired together: what one sends, the other receives. */
function linkedBuses(): [DataChannelBus, DataChannelBus, BoothMessage[], BoothMessage[]] {
  const aIn = new Subject<BoothMessage>();
  const bIn = new Subject<BoothMessage>();
  const aSent: BoothMessage[] = [];
  const bSent: BoothMessage[] = [];
  const a = { messages$: aIn.asObservable(), send: (m: BoothMessage) => (aSent.push(m), bIn.next(m), true), isOpen: true } as unknown as DataChannelBus;
  const b = { messages$: bIn.asObservable(), send: (m: BoothMessage) => (bSent.push(m), aIn.next(m), true), isOpen: true } as unknown as DataChannelBus;
  return [a, b, aSent, bSent];
}

function make(bus: DataChannelBus | null, isHost: boolean, now: () => number, offset = 0): CaptureCoordinator {
  return new CaptureCoordinator({
    bus: () => bus,
    isHost: () => isHost,
    now,
    toHostTime: (t) => t + offset,
    currentFilterId: () => 'film',
    currentLayoutId: () => 'pairPolaroid',
  });
}

describe('CaptureCoordinator', () => {
  it('host schedules directly and both sides receive the same schedule', () => {
    const [hostBus, guestBus] = linkedBuses();
    const host = make(hostBus, true, () => 10_000);
    const guest = make(guestBus, false, () => 99_999);
    host.attach();
    guest.attach();
    const got: CaptureSchedule[] = [];
    host.scheduled$.subscribe((s) => got.push(s));
    guest.scheduled$.subscribe((s) => got.push(s));

    host.request({ mode: 'strip3', shots: 3, intervalMs: 3000, countdownMs: 5000 });

    expect(got).toHaveLength(2);
    expect(got[0].captureId).toBe(got[1].captureId);
    expect(got[0].fireAt).toBe(got[1].fireAt);
    expect(got[0].fireAt).toBeGreaterThanOrEqual(15_000);
    expect(got[0]).toMatchObject({ shots: 3, intervalMs: 3000, mode: 'strip3', filterId: 'film', layoutId: 'pairPolaroid' });
  });

  it('a guest request is turned into a schedule by the host', () => {
    const [hostBus, guestBus, hostSent, guestSent] = linkedBuses();
    const host = make(hostBus, true, () => 1000);
    const guest = make(guestBus, false, () => 1000);
    host.attach();
    guest.attach();
    const hostGot: CaptureSchedule[] = [];
    const guestGot: CaptureSchedule[] = [];
    host.scheduled$.subscribe((s) => hostGot.push(s));
    guest.scheduled$.subscribe((s) => guestGot.push(s));

    guest.request({ mode: 'single', shots: 1, intervalMs: 0, countdownMs: 3000 });

    expect(guestSent[0].type).toBe('capture:request');
    expect(hostSent[0].type).toBe('capture:scheduled');
    expect(hostGot).toHaveLength(1);
    expect(guestGot).toHaveLength(1);
    expect(guestGot[0].captureId).toBe(hostGot[0].captureId);
  });

  it('the guest never schedules on its own', () => {
    const [hostBus, guestBus] = linkedBuses();
    const guest = make(guestBus, false, () => 0);
    guest.attach();
    const got: CaptureSchedule[] = [];
    guest.scheduled$.subscribe((s) => got.push(s));
    // Another guest-side request message arriving should be ignored by a guest.
    (hostBus as unknown as { send: (m: BoothMessage) => void }).send({ type: 'capture:request', mode: 'single', shots: 1, intervalMs: 0, countdownMs: 0 });
    expect(got).toHaveLength(0);
  });

  it('cancel reaches both sides', () => {
    const [hostBus, guestBus] = linkedBuses();
    const host = make(hostBus, true, () => 0);
    const guest = make(guestBus, false, () => 0);
    host.attach();
    guest.attach();
    const cancelled: string[] = [];
    host.cancelled$.subscribe((id) => cancelled.push('host:' + id));
    guest.cancelled$.subscribe((id) => cancelled.push('guest:' + id));
    guest.cancel('cap_1');
    expect(cancelled.sort()).toEqual(['guest:cap_1', 'host:cap_1']);
  });

  it('a host without a partner still schedules locally', () => {
    const host = make(null, true, () => 500);
    const got = vi.fn();
    host.scheduled$.subscribe(got);
    host.request({ mode: 'single', shots: 1, intervalMs: 0, countdownMs: 0 });
    expect(got).toHaveBeenCalledTimes(1);
  });
});
