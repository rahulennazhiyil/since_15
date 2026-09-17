import { describe, it, expect } from 'vitest';
import { buildVideoConstraints, mapMediaError } from './media-permissions';

function domError(name: string): DOMException {
  return new DOMException('boom', name);
}

describe('mapMediaError', () => {
  it.each([
    ['NotAllowedError', 'camera-denied'],
    ['PermissionDeniedError', 'camera-denied'],
    ['NotFoundError', 'camera-missing'],
    ['DevicesNotFoundError', 'camera-missing'],
    ['OverconstrainedError', 'camera-missing'],
    ['NotReadableError', 'camera-busy'],
    ['TrackStartError', 'camera-busy'],
    ['AbortError', 'camera-busy'],
    ['SecurityError', 'insecure-context'],
  ])('maps %s to %s', (name, code) => {
    const err = mapMediaError(domError(name));
    expect(err.code).toBe(code);
    expect(err.cause).toBeInstanceOf(DOMException);
  });

  it('maps TypeError (missing API) to browser-unsupported', () => {
    expect(mapMediaError(new TypeError('no mediaDevices')).code).toBe('browser-unsupported');
  });

  it('falls back to unknown for anything else', () => {
    expect(mapMediaError('weird').code).toBe('unknown');
    expect(mapMediaError(domError('SomethingNew')).code).toBe('unknown');
  });
});

describe('buildVideoConstraints', () => {
  it('prefers an exact deviceId when given', () => {
    const c = buildVideoConstraints({ facing: 'user', deviceId: 'abc' });
    expect(c.deviceId).toEqual({ exact: 'abc' });
    expect(c.facingMode).toBeUndefined();
  });

  it('uses facingMode otherwise, with ideal 720p', () => {
    const c = buildVideoConstraints({ facing: 'environment' });
    expect(c.facingMode).toBe('environment');
    expect(c.width).toEqual({ ideal: 1280 });
    expect(c.height).toEqual({ ideal: 720 });
  });
});
