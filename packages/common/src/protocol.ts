// Wire protocol, per design doc §11. Phase 1 (lobby) + Phase 2 (table state) + Phase 4 (undo).
//
// The doc specifies `undo`/`undoRequest` (§11.1, §15.2) but not how players vote on a rewind
// that needs majority consent — it only says rewinds "apply on majority consent of connected
// players." `undoVote` and `undoResolved` fill that gap.
//
// §11.1 gives `undo` a `targetRevision`; ours carries none. A revert holds older content under a
// newer revision number, so where "one step back" lands is only knowable from the history the
// server keeps (see tableHistory.ts) — a client naming a revision could only ever be guessing.
// The other three undo messages keep their `targetRevision`: by then the server has decided.
//
// `endGame`/`gameEnded` are likewise unspecified: §14.5 gained a save file, so a table now needs
// a way to say it is finished. It ends the game, not the room — everyone returns to that room's
// lobby still seated, and the host can start another game.

import type { PlayerId, RoomId } from './ids.js';
import type { RoomState } from './room.js';
import type { DeckWarningKind, UnresolvedLine } from './deck.js';
import type { Action } from './actions.js';
import type { ClientTableState } from './table.js';

export type ClientMessage =
  | { t: 'join'; roomId: RoomId; displayName: string; secret: string; seat?: number; rejoinToken?: string }
  | { t: 'deck'; list: string }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'action'; action: Action; clientSeq: number }
  | { t: 'undo' }
  | { t: 'undoVote'; targetRevision: number; approve: boolean }
  | { t: 'endGame' }
  | { t: 'freeSeat'; seat: number }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'joined'; playerId: PlayerId; roomState: RoomState; rejoinToken: string }
  | { t: 'room'; roomState: RoomState }
  | { t: 'deckResult'; warnings: DeckWarningKind[]; unresolved: UnresolvedLine[] }
  | { t: 'state'; state: ClientTableState }
  | { t: 'rejected'; clientSeq: number; reason: string }
  | { t: 'undoRequest'; requesterId: PlayerId; targetRevision: number; describes: string }
  | { t: 'undoResolved'; targetRevision: number; applied: boolean }
  | { t: 'gameEnded' }
  // `code` exists so the client can tell "your saved seat is gone, start over" from an ordinary
  // toast without matching on prose. Only set where that distinction matters.
  | { t: 'error'; message: string; code?: 'rejoin-failed' }
  | { t: 'pong' };
