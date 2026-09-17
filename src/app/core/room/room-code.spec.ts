import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  extractRoomCode,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  roomLink,
} from './room-code';

describe('room codes', () => {
  it('generates 6 characters from the alphabet, without look-alikes', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      expect(isValidRoomCode(code)).toBe(true);
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it('is unlikely to collide', () => {
    const set = new Set(Array.from({ length: 2000 }, generateRoomCode));
    expect(set.size).toBe(2000);
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
  });

  it('normalises case, spaces and dashes', () => {
    expect(normalizeRoomCode(' m7k-2p q ')).toBe('M7K2PQ');
  });

  it('extracts a code from an invite link or bare text', () => {
    expect(extractRoomCode('https://example.com/room/M7K2PQ')).toBe('M7K2PQ');
    expect(extractRoomCode('m7k2pq')).toBe('M7K2PQ');
    expect(extractRoomCode('nope')).toBeNull();
  });

  it('rejects wrong lengths and characters', () => {
    expect(isValidRoomCode('ABCDE')).toBe(false);
    expect(isValidRoomCode('ABCDEFG')).toBe(false);
    expect(isValidRoomCode('ABCDE0')).toBe(false);
  });

  it('builds invite links', () => {
    expect(roomLink('M7K2PQ', 'https://since060815.app')).toBe('https://since060815.app/room/M7K2PQ');
    expect(roomLink('M7K2PQ', 'https://user.github.io/since_15/')).toBe('https://user.github.io/since_15/room/M7K2PQ');
  });
});
