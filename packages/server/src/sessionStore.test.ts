import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decode, encode, savedHostSecret, type PersistedFile } from './sessionStore.js';
import { Room } from './roomManager.js';
import type { TableState } from '@command-table/common';

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

function seatedRoom() {
  const room = new Room('ABC123');
  room.join({ displayName: 'Alice' });
  return room;
}

function table(roomId: string): TableState {
  return { roomId, objects: {}, players: [], turn: { turnNumber: 1, activePlayerId: 'p1', phase: 'main' }, log: [], revision: 3, createdAt: NOW, setupComplete: true };
}

function fileWith(sessions: PersistedFile['sessions']): PersistedFile {
  return { version: 1, hostSecret: 'forest3', sessions };
}

describe('sessionStore encode/decode', () => {
  it('round-trips a room and its table through JSON', () => {
    const room = seatedRoom();
    const encoded = encode('forest3', [{ room, table: table(room.roomId) }], NOW);

    const decoded = decode(JSON.parse(JSON.stringify(encoded)), NOW);

    expect(decoded?.hostSecret).toBe('forest3');
    expect(decoded?.sessions[room.roomId].table?.revision).toBe(3);
    expect(Room.fromSnapshot(decoded!.sessions[room.roomId].room).toState().seats[0].displayName).toBe('Alice');
  });

  it('keeps a room whose game has ended, with a null table', () => {
    const room = seatedRoom();
    const encoded = encode('forest3', [{ room, table: null }], NOW);

    const decoded = decode(JSON.parse(JSON.stringify(encoded)), NOW);

    expect(decoded?.sessions[room.roomId]).toBeDefined();
    expect(decoded?.sessions[room.roomId].table).toBeNull();
  });

  // A restart must never be blocked by whatever is on disk, so every rejection path returns null
  // rather than throwing.
  it('returns null for a file from a future or unknown version', () => {
    expect(decode({ ...fileWith({}), version: 2 }, NOW)).toBeNull();
  });

  it('returns null for a shape that is not a persisted file at all', () => {
    expect(decode(null, NOW)).toBeNull();
    expect(decode('garbage', NOW)).toBeNull();
    expect(decode({ version: 1 }, NOW)).toBeNull();
  });

  it('drops sessions older than the 24h TTL but keeps fresh ones', () => {
    const fresh = seatedRoom();
    const stale = new Room('OLD999');
    const file = fileWith({
      [fresh.roomId]: { room: fresh.toSnapshot(), table: null, savedAt: NOW - HOUR },
      [stale.roomId]: { room: stale.toSnapshot(), table: null, savedAt: NOW - 25 * HOUR },
    });

    const decoded = decode(file, NOW);

    expect(Object.keys(decoded!.sessions)).toEqual([fresh.roomId]);
  });
});

describe('savedHostSecret', () => {
  it('reads the passphrase a previous run saved, and nothing when there is no save', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sessions-'));
    const path = join(dir, 'sessions.json');
    expect(savedHostSecret(path)).toBeUndefined();
    writeFileSync(path, JSON.stringify(encode('Y3VTPS', [], Date.now())));
    expect(savedHostSecret(path)).toBe('Y3VTPS');
  });
});
