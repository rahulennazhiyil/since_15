import { environment } from '../../../environments/environment';

/** STUN by default; TURN is a configuration change in the environment file. */
export function buildRtcConfiguration(): RTCConfiguration {
  return {
    iceServers: environment.webrtc.iceServers,
    iceCandidatePoolSize: 2,
    bundlePolicy: 'max-bundle',
  };
}
