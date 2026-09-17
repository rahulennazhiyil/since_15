export type SignalingProvider = 'supabase' | 'broadcast';

export interface AppEnvironment {
  production: boolean;
  signaling: {
    provider: SignalingProvider;
    supabaseUrl: string;
    supabaseAnonKey: string;
  };
  webrtc: {
    iceServers: RTCIceServer[];
  };
  room: {
    maxParticipants: number;
    /** How long a host may sit alone in WAITING before the room ends itself. */
    hostIdleTimeoutMs: number;
    /** How long a joiner waits for the host's presence before "room not found". */
    joinLookupTimeoutMs: number;
  };
  photo: {
    maxLongEdge: number;
    jpegQuality: number;
  };
}
