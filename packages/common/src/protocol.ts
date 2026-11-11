// Wire protocol. Phase 1 (lobby) + Phase 2 (table state) + Phase 4 (undo).
//
// A rewind needs majority consent of connected players: `undoRequest` puts it to the table,
// players answer with `undoVote`, and `undoResolved` announces the outcome.
//
// `undo` carries no `targetRevision`. A revert holds older content under a newer revision
// number, so where "one step back" lands is only knowable from the history the server keeps
// (see tableHistory.ts) — a client naming a revision could only ever be guessing. It carries
// instead the `revision` of the action the client believes it is taking back (the `undoable` it
// last saw), so the server can refuse once another action has landed in between rather than
// undo, or put to a vote, an action the player never saw named. The other three undo messages
// keep their `targetRevision`: by then the server has decided.
//
// `endGame`/`gameEnded`: now that games are saved to a file, a table needs a way to say it is
// finished. It ends the game, not the room — everyone returns to that room's lobby still seated,
// and the host can start another game.

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
  | { t: 'undo'; revision: number }
  | { t: 'undoVote'; targetRevision: number; approve: boolean }
  | { t: 'endGame' }
  | { t: 'freeSeat'; seat: number }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'joined'; playerId: PlayerId; roomState: RoomState; rejoinToken: string }
  | { t: 'room'; roomState: RoomState }
  | { t: 'deckResult'; warnings: DeckWarningKind[]; unresolved: UnresolvedLine[] }
  // `undoable` rides beside the state, not in it: it is the server's undo history speaking
  // (tableHistory.ts), and the only way a client can name what its Undo would take back.
  | { t: 'state'; state: ClientTableState; undoable: UndoableAction | null }
  | { t: 'rejected'; clientSeq: number; reason: string }
  // Sent to everyone, the requester included, and again after every ballot: `approvals` of
  // `needed` is the tally a vote is waiting on.
  | { t: 'undoRequest'; requesterId: PlayerId; targetRevision: number; describes: string; approvals: number; needed: number }
  // `cancelled`: somebody acted before the vote finished, which moves the table out from under it.
  | { t: 'undoResolved'; targetRevision: number; outcome: 'applied' | 'rejected' | 'cancelled' }
  | { t: 'gameEnded' }
  // `code` exists so the client can tell "your saved seat is gone, start over" from an ordinary
  // toast without matching on prose. Only set where that distinction matters.
  | { t: 'error'; message: string; code?: 'rejoin-failed' }
  | { t: 'pong' };

/** The action Undo would take back: the revision it produced (its log lines carry it) and whose it was. */
export interface UndoableAction {
  revision: number;
  actorId: PlayerId;
}

/**
 * The WebSocket close code a socket gets when its seat is opened on another socket. The client
 * stops on it instead of reconnecting: two tabs on one seat would otherwise take it back and forth.
 */
export const SUPERSEDED = 4001;
