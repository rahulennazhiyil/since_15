/** Pure helpers shared by the activities. No Angular, no DOM. */

// Two choices ----------------------------------------------------------------

export type Pick = 'a' | 'b';

export interface TwoChoiceRound {
  index: number;
  picks: { self?: Pick; partner?: Pick };
}

export function newRound(index: number): TwoChoiceRound {
  return { index, picks: {} };
}

export function recordPick(round: TwoChoiceRound, who: 'self' | 'partner', pick: Pick): TwoChoiceRound {
  if (round.picks[who]) return round;
  return { ...round, picks: { ...round.picks, [who]: pick } };
}

export function roundRevealed(round: TwoChoiceRound): boolean {
  return round.picks.self !== undefined && round.picks.partner !== undefined;
}

export function roundMatched(round: TwoChoiceRound): boolean | null {
  return roundRevealed(round) ? round.picks.self === round.picks.partner : null;
}

/** Next card that is not the current one. `random` in [0, 1). */
export function nextIndex(current: number, count: number, random = Math.random): number {
  if (count <= 1) return 0;
  const step = 1 + Math.floor(random() * (count - 1));
  return (current + step) % count;
}

// Bucket list ------------------------------------------------------------------

export interface BucketItem {
  id: string;
  text: string;
  done: boolean;
  /** Last change, ms. Later wins on conflicts. */
  updatedAt: number;
}

/** Union by id; on conflict the more recent edit wins. Sorted with open items first. */
export function mergeBucketLists(mine: BucketItem[], theirs: BucketItem[]): BucketItem[] {
  const byId = new Map<string, BucketItem>();
  for (const item of [...mine, ...theirs]) {
    const existing = byId.get(item.id);
    if (!existing || item.updatedAt > existing.updatedAt) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => Number(a.done) - Number(b.done) || a.updatedAt - b.updatedAt);
}

// Distance ---------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatDistance(km: number): string {
  if (km < 1) return 'Practically the same place';
  const rounded = km < 100 ? Math.round(km) : Math.round(km / 10) * 10;
  return `${rounded.toLocaleString('en-GB')} km apart`;
}

// Countdown --------------------------------------------------------------------

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  past: boolean;
}

export function remainingUntil(target: number, now: number): Remaining {
  const diff = target - now;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  return { days, hours, minutes, past: diff < 0 };
}

export function describeRemaining(r: Remaining): string {
  if (r.past) return r.days === 0 ? 'Today!' : `${r.days} day${r.days === 1 ? '' : 's'} ago`;
  if (r.days === 0 && r.hours === 0) return 'Any minute now';
  if (r.days === 0) return `${r.hours} hour${r.hours === 1 ? '' : 's'} to go`;
  return `${r.days} day${r.days === 1 ? '' : 's'} to go`;
}

// Drawing ----------------------------------------------------------------------

export interface Stroke {
  id: string;
  color: string;
  /** Width as a fraction of the canvas' shorter edge. */
  size: number;
  /** Flat [x0, y0, x1, y1, ...] in 0..1. */
  points: number[];
}

export function isStroke(value: unknown): value is Stroke {
  const s = value as Stroke;
  return (
    !!s &&
    typeof s.id === 'string' &&
    typeof s.color === 'string' &&
    typeof s.size === 'number' &&
    Array.isArray(s.points) &&
    s.points.length >= 2 &&
    s.points.length % 2 === 0 &&
    s.points.every((n) => typeof n === 'number' && n >= -0.01 && n <= 1.01)
  );
}
