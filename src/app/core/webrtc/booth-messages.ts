import { LAYOUTS } from '../photo/layouts';
import { isBackgroundFx, isBackgroundId, isPersonRole, isPlacement, isSceneState, type BackgroundFx, type PersonRole, type Placement, type SceneState } from '../scene/scene.model';

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
  /** What this device can do; sent when the channel opens and whenever it changes. */
  | { type: 'caps'; v: 1; segmentation: boolean; mirrored: boolean }
  /** Shared scene, one field at a time so two people can edit at once. */
  | { type: 'scene:place'; person: PersonRole; placement: Placement }
  | { type: 'scene:background'; backgroundId: string; fx: BackgroundFx }
  | { type: 'scene:front'; front: PersonRole }
  | { type: 'scene:frame'; layoutId: string }
  | { type: 'scene:ask' }
  | { type: 'scene:full'; scene: SceneState }
  /** The receiver has stored a custom background the sender shared. */
  | { type: 'scene:bg-ready'; id: string }
  | { type: 'capture:request'; mode: string; shots: number; intervalMs: number; countdownMs: number }
  | {
      type: 'capture:scheduled';
      captureId: string;
      fireAt: number;
      shots: number;
      intervalMs: number;
      filterId: string;
      layoutId: string;
      mode: string;
      /** Both devices cut people out and compose one scene (host's snapshot below). */
      together: boolean;
      scene: SceneState | null;
    }
  | { type: 'capture:cancel'; captureId: string }
  /** One envelope for every couple activity; each activity validates its own payload. */
  | { type: 'activity'; activity: string; payload: unknown };

type Raw = Record<string, unknown>;
const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const bool = (v: unknown): v is boolean => typeof v === 'boolean';

/** One shape check per message type. Unknown types and malformed payloads are dropped. */
const VALIDATORS: Record<BoothMessage['type'], (m: Raw) => boolean> = {
  ping: (m) => num(m['id']) && num(m['sentAt']),
  pong: (m) => num(m['id']) && num(m['sentAt']) && num(m['receivedAt']),
  mic: (m) => bool(m['enabled']),
  filter: (m) => str(m['filterId']),
  layout: (m) => str(m['layoutId']),
  caps: (m) => m['v'] === 1 && bool(m['segmentation']) && bool(m['mirrored']),
  'scene:place': (m) => isPersonRole(m['person']) && isPlacement(m['placement']),
  'scene:background': (m) => isBackgroundId(m['backgroundId']) && isBackgroundFx(m['fx']),
  'scene:front': (m) => isPersonRole(m['front']),
  'scene:frame': (m) => str(m['layoutId']) && m['layoutId'] in LAYOUTS,
  'scene:ask': () => true,
  'scene:full': (m) => isSceneState(m['scene']),
  'scene:bg-ready': (m) => isBackgroundId(m['id']),
  'capture:request': (m) => str(m['mode']) && num(m['shots']) && num(m['intervalMs']) && num(m['countdownMs']),
  'capture:scheduled': (m) =>
    str(m['captureId']) &&
    num(m['fireAt']) &&
    num(m['shots']) &&
    num(m['intervalMs']) &&
    str(m['filterId']) &&
    str(m['layoutId']) &&
    str(m['mode']) &&
    bool(m['together']) &&
    (m['scene'] === null || isSceneState(m['scene'])),
  'capture:cancel': (m) => str(m['captureId']),
  activity: (m) => str(m['activity']) && 'payload' in m,
};

/** Parses one wire frame. Anything malformed is dropped rather than thrown. */
export function parseBoothMessage(raw: unknown): BoothMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const value = JSON.parse(raw) as Raw | null;
    if (!value || typeof value !== 'object' || typeof value['type'] !== 'string') return null;
    const validate = VALIDATORS[value['type'] as BoothMessage['type']];
    if (!validate || !validate(value)) return null;
    return value as unknown as BoothMessage;
  } catch {
    return null;
  }
}
