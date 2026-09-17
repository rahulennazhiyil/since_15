import { ERROR_COPY, type ErrorCopy } from './error-copy';

export type AppErrorCode =
  | 'camera-denied'
  | 'microphone-denied'
  | 'camera-missing'
  | 'camera-busy'
  | 'insecure-context'
  | 'browser-unsupported'
  | 'connection-failed'
  | 'network-interrupted'
  | 'room-not-found'
  | 'room-full'
  | 'room-ended'
  | 'partner-left'
  | 'invalid-room-code'
  | 'photo-failed'
  | 'storage-failed'
  | 'scene-unsupported'
  | 'unknown';

/**
 * The only error type that reaches the UI. `userMessage` is always safe to display;
 * `cause` keeps the technical detail for logs.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  override readonly cause: unknown;

  constructor(code: AppErrorCode, options: { cause?: unknown; detail?: string } = {}) {
    super(options.detail ?? code);
    this.name = 'AppError';
    this.code = code;
    this.cause = options.cause;
  }

  get userMessage(): ErrorCopy {
    return ERROR_COPY[this.code];
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Wraps anything thrown into an AppError without losing the original. */
export function toAppError(value: unknown, fallback: AppErrorCode = 'unknown'): AppError {
  if (isAppError(value)) return value;
  return new AppError(fallback, { cause: value });
}
