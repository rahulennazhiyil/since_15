import { describe, expect, it } from 'vitest';
import { estimateOffset } from './clock-sync';

describe('estimateOffset', () => {
  it('is zero with no samples', () => {
    expect(estimateOffset([])).toEqual({ offset: 0, rtt: 0, samples: 0 });
  });

  it('recovers a constant offset from symmetric latency', () => {
    // Remote clock is 500 ms ahead; 40 ms each way.
    const samples = [0, 100, 200].map((t) => ({ sentAt: t, returnedAt: t + 80, remoteAt: t + 40 + 500 }));
    const e = estimateOffset(samples);
    expect(e.offset).toBe(500);
    expect(e.rtt).toBe(80);
    expect(e.samples).toBe(3);
  });

  it('uses the median so one delayed sample does not skew the result', () => {
    const good = [0, 100, 200, 300].map((t) => ({ sentAt: t, returnedAt: t + 60, remoteAt: t + 30 - 200 }));
    const spike = { sentAt: 400, returnedAt: 400 + 900, remoteAt: 400 + 30 - 200 }; // reply stuck 840 ms
    const e = estimateOffset([...good, spike]);
    expect(e.offset).toBe(-200);
    expect(e.rtt).toBe(60);
  });

  it('averages the two middle samples for even counts', () => {
    const e = estimateOffset([
      { sentAt: 0, returnedAt: 100, remoteAt: 50 + 10 },
      { sentAt: 0, returnedAt: 100, remoteAt: 50 + 30 },
    ]);
    expect(e.offset).toBe(20);
  });
});
