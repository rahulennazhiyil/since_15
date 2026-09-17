import type { AppEnvironment } from './environment.model';

/**
 * Development configuration. The BroadcastChannel signaling transport lets two tabs of
 * the same browser run the full room flow with no external account.
 */
export const environment: AppEnvironment = {
  production: false,
  signaling: {
    provider: 'broadcast',
    supabaseUrl: '',
    supabaseAnonKey: '',
  },
  webrtc: {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  },
  room: {
    maxParticipants: 2,
    hostIdleTimeoutMs: 30 * 60 * 1000,
    joinLookupTimeoutMs: 8_000,
  },
  photo: {
    maxLongEdge: 2048,
    jpegQuality: 0.92,
  },
};
