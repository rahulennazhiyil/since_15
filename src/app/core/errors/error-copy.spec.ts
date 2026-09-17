import { describe, it, expect } from 'vitest';
import { ERROR_COPY } from './error-copy';
import { AppError, toAppError, type AppErrorCode } from './app-error';

const ALL_CODES: AppErrorCode[] = [
  'camera-denied',
  'microphone-denied',
  'camera-missing',
  'camera-busy',
  'insecure-context',
  'browser-unsupported',
  'connection-failed',
  'network-interrupted',
  'room-not-found',
  'room-full',
  'room-ended',
  'partner-left',
  'invalid-room-code',
  'photo-failed',
  'storage-failed',
  'unknown',
];

const TECHNICAL_TERMS =
  /\b(ICE|WebRTC|RTC|DOMException|NotAllowedError|getUserMedia|SDP|peer|socket|WebSocket|IndexedDB|localStorage)\b/i;

describe('ERROR_COPY', () => {
  it('has a title and message for every code', () => {
    for (const code of ALL_CODES) {
      expect(ERROR_COPY[code].title.length, code).toBeGreaterThan(0);
      expect(ERROR_COPY[code].message.length, code).toBeGreaterThan(0);
    }
  });

  it('never exposes technical vocabulary', () => {
    for (const code of ALL_CODES) {
      const { title, message, action } = ERROR_COPY[code];
      expect(`${title} ${message} ${action ?? ''}`, code).not.toMatch(TECHNICAL_TERMS);
    }
  });
});

describe('AppError', () => {
  it('exposes friendly copy for its code', () => {
    const err = new AppError('camera-denied', { cause: new Error('NotAllowedError') });
    expect(err.userMessage).toBe(ERROR_COPY['camera-denied']);
    expect(err.cause).toBeInstanceOf(Error);
  });

  it('toAppError wraps unknown values and passes AppErrors through', () => {
    const original = new AppError('room-full');
    expect(toAppError(original)).toBe(original);
    const wrapped = toAppError(new TypeError('boom'), 'photo-failed');
    expect(wrapped.code).toBe('photo-failed');
    expect(wrapped.cause).toBeInstanceOf(TypeError);
  });
});
