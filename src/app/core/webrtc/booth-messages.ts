/**
 * Everything the two peers say to each other over the "booth" data channel. Room
 * lifecycle stays on signaling; this is for the experience itself.
 */
export type BoothMessage =
  | { type: 'ping'; id: number; sentAt: number }
  | { type: 'pong'; id: number; sentAt: number; receivedAt: number }
  | { type: 'mic'; enabled: boolean }
  | { type: 'filter'; filterId: string }
  | { type: 'layout'; layoutId: string }
  | { type: 'capture:request'; mode: string; shots: number; intervalMs: number; countdownMs: number }
  | { type: 'capture:scheduled'; captureId: string; fireAt: number; shots: number; intervalMs: number; filterId: string; layoutId: string; mode: string }
  | { type: 'capture:cancel'; captureId: string }
  | { type: 'capture:frame-ready'; captureId: string; shot: number; blobId: string }
  /** One envelope for every couple activity; each activity validates its own payload. */
  | { type: 'activity'; activity: string; payload: unknown };

const TYPES: ReadonlySet<BoothMessage['type']> = new Set<BoothMessage['type']>([
  'ping',
  'pong',
  'mic',
  'filter',
  'layout',
  'capture:request',
  'capture:scheduled',
  'capture:cancel',
  'capture:frame-ready',
  'activity',
]);

/** Parses one wire frame. Anything malformed is dropped rather than thrown. */
export function parseBoothMessage(raw: unknown): BoothMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const value = JSON.parse(raw) as { type?: unknown };
    if (!value || typeof value !== 'object' || typeof value.type !== 'string') return null;
    if (!TYPES.has(value.type as BoothMessage['type'])) return null;
    return value as BoothMessage;
  } catch {
    return null;
  }
}
