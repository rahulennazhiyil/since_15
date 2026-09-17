import type { ParticipantRole } from '../signaling/signaling-transport';

export interface Participant {
  id: string;
  name: string;
  emoji: string;
  color: string;
  role: ParticipantRole;
  joinedAt: number;
}

/**
 * idle        not in a room
 * looking     guest is waiting to see the host's presence
 * waiting     host is alone, invite link shown
 * connected   both people present
 * disconnected partner left after having been connected (host keeps the room open)
 * reconnecting media link dropped, retrying (Phase 6)
 * ended       host left or closed the room
 * not-found   no host answered within the lookup window
 * full        the room already had two people
 */
export type RoomStatus =
  | 'idle'
  | 'looking'
  | 'waiting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'ended'
  | 'not-found'
  | 'full';

export interface Room {
  code: string;
  hostId: string;
  participants: Participant[];
  createdAt: number;
}
