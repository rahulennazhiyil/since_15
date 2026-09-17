import { describe, expect, it } from 'vitest';
import {
  describeRemaining,
  formatDistance,
  haversineKm,
  isStroke,
  mergeBucketLists,
  newRound,
  nextIndex,
  recordPick,
  remainingUntil,
  roundMatched,
  roundRevealed,
} from './activity-logic';

describe('two choices', () => {
  it('reveals only when both have picked and reports a match', () => {
    let r = newRound(3);
    expect(roundRevealed(r)).toBe(false);
    expect(roundMatched(r)).toBeNull();
    r = recordPick(r, 'self', 'a');
    expect(roundRevealed(r)).toBe(false);
    r = recordPick(r, 'partner', 'a');
    expect(roundRevealed(r)).toBe(true);
    expect(roundMatched(r)).toBe(true);
  });

  it('ignores a second pick from the same person', () => {
    const r = recordPick(recordPick(newRound(0), 'self', 'a'), 'self', 'b');
    expect(r.picks.self).toBe('a');
  });

  it('nextIndex never repeats the current card', () => {
    for (let i = 0; i < 50; i++) expect(nextIndex(4, 10)).not.toBe(4);
    expect(nextIndex(0, 1)).toBe(0);
    expect(nextIndex(9, 10, () => 0)).toBe(0);
    expect(nextIndex(0, 10, () => 0.999)).toBe(9);
  });
});

describe('mergeBucketLists', () => {
  it('unions by id, lets the newer edit win, and lists open items first', () => {
    const mine = [
      { id: 'a', text: 'Visit Japan', done: false, updatedAt: 1 },
      { id: 'b', text: 'Cook together', done: true, updatedAt: 5 },
    ];
    const theirs = [
      { id: 'a', text: 'Visit Japan', done: true, updatedAt: 2 },
      { id: 'c', text: 'Road trip', done: false, updatedAt: 3 },
    ];
    const merged = mergeBucketLists(mine, theirs);
    expect(merged.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(merged.find((i) => i.id === 'a')?.done).toBe(true);
  });
});

describe('distance', () => {
  it('measures London to Paris at roughly 340 km', () => {
    const km = haversineKm(51.51, -0.13, 48.86, 2.35);
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(350);
  });

  it('formats sensibly', () => {
    expect(formatDistance(0.4)).toBe('Practically the same place');
    expect(formatDistance(42.4)).toBe('42 km apart');
    expect(formatDistance(1284)).toBe('1,280 km apart');
  });
});

describe('countdown', () => {
  const now = Date.UTC(2026, 8, 16, 12, 0, 0);

  it('splits the remaining time', () => {
    const r = remainingUntil(now + 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000, now);
    expect(r).toEqual({ days: 2, hours: 3, minutes: 4, past: false });
    expect(describeRemaining(r)).toBe('2 days to go');
  });

  it('describes the last day, the moment and the past', () => {
    expect(describeRemaining(remainingUntil(now + 5 * 3_600_000, now))).toBe('5 hours to go');
    expect(describeRemaining(remainingUntil(now + 30_000, now))).toBe('Any minute now');
    expect(describeRemaining(remainingUntil(now - 3_600_000, now))).toBe('Today!');
    expect(describeRemaining(remainingUntil(now - 3 * 86_400_000, now))).toBe('3 days ago');
  });
});

describe('isStroke', () => {
  it('accepts normalised strokes and rejects junk', () => {
    expect(isStroke({ id: 's', color: '#fff', size: 0.02, points: [0, 0, 0.5, 0.5] })).toBe(true);
    expect(isStroke({ id: 's', color: '#fff', size: 0.02, points: [0, 0, 5] })).toBe(false);
    expect(isStroke({ id: 's', color: '#fff', size: 0.02, points: [0, 0, 2, 2] })).toBe(false);
    expect(isStroke(null)).toBe(false);
  });
});
