// Unguessable room codes. Crypto-random, not sequential.

import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — avoids miscopied codes
const LENGTH = 6;

export function generateRoomCode(): string {
  const bytes = randomBytes(LENGTH);
  let code = '';
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
