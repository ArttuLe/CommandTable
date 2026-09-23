// Snapshot of in-flight games to disk, per design doc §14.5: "periodically write TableState
// snapshots to a local file so a crash or deploy can restore rooms... doesn't require a database
// or violate the 'no user persistence' requirement, since it's transient operational state with
// a short TTL." That last clause is the TTL below.
//
// A plain JSON file, not SQLite: TableState is already plain JSON (common/src/table.ts holds no
// Maps or class instances), and the card DB is opened readonly so reusing it would mean giving
// that up. The host's generated passphrase rides along because otherwise a restart would mint a
// new one and lock out every client holding the old one.
//
// Undo history is deliberately not persisted — TableHistory keeps 50 full TableStates, which
// would bloat the file ~50x. After a restore you can undo back to the restart point, not past it.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RoomId, TableState } from '@command-table/common';
import { Room, type RoomSnapshot } from './roomManager.js';

const VERSION = 1;
const TTL_MS = 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 1000;

export interface SessionEntry {
  room: Room;
  table: TableState | null;
}

interface PersistedSession {
  room: RoomSnapshot;
  table: TableState | null;
  savedAt: number;
}

export interface PersistedFile {
  version: typeof VERSION;
  hostSecret: string;
  sessions: Record<RoomId, PersistedSession>;
}

export function encode(hostSecret: string, entries: SessionEntry[], now: number): PersistedFile {
  const sessions: Record<RoomId, PersistedSession> = {};
  for (const { room, table } of entries) {
    sessions[room.roomId] = { room: room.toSnapshot(), table, savedAt: now };
  }
  return { version: VERSION, hostSecret, sessions };
}

// Returns null rather than throwing on anything unrecognisable: a corrupt or hand-edited file
// must cost you the saved games, never the ability to start the server.
export function decode(raw: unknown, now: number): PersistedFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const file = raw as Partial<PersistedFile>;
  if (file.version !== VERSION) return null;
  if (typeof file.hostSecret !== 'string') return null;
  if (typeof file.sessions !== 'object' || file.sessions === null) return null;

  const sessions: Record<RoomId, PersistedSession> = {};
  for (const [roomId, session] of Object.entries(file.sessions)) {
    if (typeof session?.savedAt !== 'number' || typeof session.room?.roomId !== 'string') continue;
    if (now - session.savedAt > TTL_MS) continue;
    sessions[roomId] = session;
  }
  return { version: VERSION, hostSecret: file.hostSecret, sessions };
}

export class SessionStore {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly path: string,
    private readonly collect: () => { hostSecret: string; entries: SessionEntry[] },
  ) {}

  load(now = Date.now()): PersistedFile | null {
    try {
      return decode(JSON.parse(readFileSync(this.path, 'utf8')), now);
    } catch {
      return null;
    }
  }

  // Debounced because a burst of actions shouldn't mean a burst of writes; the whole file is
  // rewritten either way, so there is nothing to accumulate per room.
  markDirty(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.write();
    }, DEBOUNCE_MS);
    this.timer.unref();
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.write();
  }

  private write(): void {
    const { hostSecret, entries } = this.collect();
    const json = JSON.stringify(encode(hostSecret, entries, Date.now()));
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      // Write-then-rename: the point of this file is surviving a crash, so a half-written one is
      // the single failure mode that must be impossible.
      writeFileSync(`${this.path}.tmp`, json);
      renameSync(`${this.path}.tmp`, this.path);
    } catch (err) {
      console.error('Could not save session state:', err);
    }
  }
}
