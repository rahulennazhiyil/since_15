/** No 0/O/1/I so codes survive being read aloud or typed from a photo. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
  return code;
}

/** Uppercases, maps look-alikes, strips everything that is not a code character. */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/[^A-Z2-9]/g, '')
    .replace(/[OI]/g, (c) => (c === 'O' ? 'Q' : 'J'))
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c));
}

/** Pulls a code out of a pasted invite link or a bare code. */
export function extractRoomCode(text: string): string | null {
  const match = /room\/([A-Za-z0-9]{4,8})/.exec(text);
  const candidate = normalizeRoomCode(match ? match[1] : text);
  return isValidRoomCode(candidate) ? candidate : null;
}

/**
 * Full invite link for a room. Resolved against the document base so the app also works
 * when it is served from a sub-path (for example a GitHub Pages project site).
 */
export function roomLink(code: string, base = typeof document !== 'undefined' ? document.baseURI : ''): string {
  try {
    return new URL(`room/${code}`, base).toString();
  } catch {
    return `/room/${code}`;
  }
}
