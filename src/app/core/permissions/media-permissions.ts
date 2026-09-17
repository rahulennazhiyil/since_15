import { AppError, toAppError } from '../errors/app-error';

export type FacingMode = 'user' | 'environment';

export interface CameraStreamRequest {
  facing: FacingMode;
  audio: boolean;
  deviceId?: string;
}

export interface CameraStreamResult {
  stream: MediaStream;
  /** True when video was granted but the microphone was refused or missing. */
  audioDenied: boolean;
}

const IDEAL_WIDTH = 1280;
const IDEAL_HEIGHT = 720;

export function buildVideoConstraints(req: Pick<CameraStreamRequest, 'facing' | 'deviceId'>): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    width: { ideal: IDEAL_WIDTH },
    height: { ideal: IDEAL_HEIGHT },
  };
  if (req.deviceId) return { ...base, deviceId: { exact: req.deviceId } };
  return { ...base, facingMode: req.facing };
}

/** DOMException is not an Error subclass everywhere, so read the name structurally. */
function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = (error as { name: unknown }).name;
    return typeof name === 'string' ? name : '';
  }
  return '';
}

/** Translates every getUserMedia failure into copy a person can act on. */
export function mapMediaError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  switch (errorName(error)) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new AppError('camera-denied', { cause: error });
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return new AppError('camera-missing', { cause: error });
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new AppError('camera-busy', { cause: error });
    case 'SecurityError':
      return new AppError('insecure-context', { cause: error });
    case 'TypeError':
      return new AppError('browser-unsupported', { cause: error });
    default:
      return toAppError(error);
  }
}

function hasName(error: unknown, ...names: string[]): boolean {
  return names.includes(errorName(error));
}

/**
 * Requests a camera (and optionally microphone) stream with sensible fallbacks:
 * a facing mode the device lacks falls back to any camera, and a refused
 * microphone falls back to video only rather than failing the whole request.
 */
export async function requestCameraStream(req: CameraStreamRequest): Promise<CameraStreamResult> {
  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!media || typeof media.getUserMedia !== 'function') throw new AppError('browser-unsupported');
  if (typeof window !== 'undefined' && !window.isSecureContext) throw new AppError('insecure-context');

  const video = buildVideoConstraints(req);

  try {
    const stream = await media.getUserMedia({ video, audio: req.audio });
    return { stream, audioDenied: req.audio && stream.getAudioTracks().length === 0 };
  } catch (error) {
    // Some devices report a missing camera when a facing mode or size cannot be met.
    // Retry with the loosest possible request before concluding there is no camera.
    if (hasName(error, 'OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError')) {
      try {
        const stream = await media.getUserMedia({ video: true, audio: req.audio });
        return { stream, audioDenied: req.audio && stream.getAudioTracks().length === 0 };
      } catch (retryError) {
        throw mapMediaError(retryError);
      }
    }

    if (req.audio && hasName(error, 'NotAllowedError', 'NotFoundError', 'NotReadableError')) {
      try {
        const stream = await media.getUserMedia({ video, audio: false });
        return { stream, audioDenied: true };
      } catch (retryError) {
        throw mapMediaError(retryError);
      }
    }

    throw mapMediaError(error);
  }
}

export function stopTracks(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}
