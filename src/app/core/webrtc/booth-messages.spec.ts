import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE } from '../scene/scene.model';
import { parseBoothMessage } from './booth-messages';

const wire = (m: unknown): string => JSON.stringify(m);

describe('parseBoothMessage', () => {
  it('accepts well-formed messages of every kind it knows', () => {
    const ok = [
      { type: 'ping', id: 1, sentAt: 10 },
      { type: 'mic', enabled: false },
      { type: 'caps', v: 1, segmentation: true, mirrored: false },
      { type: 'scene:place', person: 'guest', placement: { x: 0.7, y: 0.5, scale: 1, flip: false } },
      { type: 'scene:background', backgroundId: 'neon', fx: { blur: 0.2, dim: 0 } },
      { type: 'scene:front', front: 'host' },
      { type: 'scene:frame', layoutId: 'polaroid' },
      { type: 'scene:ask' },
      { type: 'scene:full', scene: DEFAULT_SCENE },
      { type: 'scene:bg-ready', id: 'custom:abcdef0123456789' },
      { type: 'capture:scheduled', captureId: 'c', fireAt: 1, shots: 1, intervalMs: 0, filterId: 'f', layoutId: 'single', mode: 'single', together: true, scene: DEFAULT_SCENE },
      { type: 'activity', activity: 'drawing', payload: { ask: true } },
    ];
    for (const m of ok) expect(parseBoothMessage(wire(m)), m.type).toEqual(m);
  });

  it('drops unknown types, malformed payloads and non-JSON', () => {
    const bad = [
      { type: 'capture:frame-ready', captureId: 'c', shot: 0, blobId: 'b' }, // retired
      { type: 'scene:place', person: 'alien', placement: { x: 0.7, y: 0.5, scale: 1, flip: false } },
      { type: 'scene:place', person: 'host', placement: { x: 0.7, y: 0.5, scale: 0, flip: false } },
      { type: 'scene:background', backgroundId: 'bad id!', fx: { blur: 0, dim: 0 } },
      { type: 'scene:frame', layoutId: 'nope' },
      { type: 'scene:full', scene: { ...DEFAULT_SCENE, front: 'nobody' } },
      { type: 'caps', v: 2, segmentation: true, mirrored: false },
      { type: 'capture:scheduled', captureId: 'c', fireAt: 1, shots: 1, intervalMs: 0, filterId: 'f', layoutId: 'single', mode: 'single' }, // missing together
      { type: 'mic', enabled: 'yes' },
    ];
    for (const m of bad) expect(parseBoothMessage(wire(m)), JSON.stringify(m)).toBeNull();
    expect(parseBoothMessage('not json')).toBeNull();
    expect(parseBoothMessage(42)).toBeNull();
    expect(parseBoothMessage(wire({ nope: true }))).toBeNull();
  });
});
