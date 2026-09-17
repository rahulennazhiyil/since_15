import type { AppEnvironment } from './environment.model';
import { SECRETS } from './env.secrets';

/**
 * Production configuration. Account-specific values come from `env.secrets.ts`, which
 * `scripts/write-env.mjs` generates from environment variables (GitHub Actions secrets in
 * CI, `.env.local` on a developer machine). Nothing account-specific is committed.
 *
 * Without secrets the build still works: signaling falls back to the same-browser
 * transport and ICE is STUN only.
 */
const iceServers: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.relay.metered.ca:80'] },
];

if (SECRETS.turnUsername && SECRETS.turnCredential) {
  // Metered TURN relay for the pairs that cannot connect directly. It only forwards
  // encrypted packets; video still goes browser to browser.
  iceServers.push({
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turns:global.relay.metered.ca:443?transport=tcp',
    ],
    username: SECRETS.turnUsername,
    credential: SECRETS.turnCredential,
  });
}

export const environment: AppEnvironment = {
  production: true,
  signaling: {
    provider: 'supabase',
    supabaseUrl: SECRETS.supabaseUrl,
    supabaseAnonKey: SECRETS.supabaseAnonKey,
  },
  webrtc: { iceServers },
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
