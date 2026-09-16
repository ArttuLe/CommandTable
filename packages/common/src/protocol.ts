// Wire protocol, per design doc §11. Phase 1 (lobby) + Phase 2 (table state) + Phase 4 (undo).
//
// The doc specifies `undo`/`undoRequest` (§11.1, §15.2) but not how players vote on a rewind
// that needs majority consent — it only says rewinds "apply on majority consent of connected
// players." `undoVote` and `undoResolved` fill that gap.

import type { PlayerId, RoomId } from './ids.js';
import type { RoomState } from './room.js';
import type { DeckWarningKind, UnresolvedLine } from './deck.js';
import type { Action } from './actions.js';
import type { ClientTableState } from './table.js';

export type ClientMessage =
  | { t: 'join'; roomId: RoomId; displayName: string; seat?: number; rejoinToken?: string }
  | { t: 'deck'; list: string }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'action'; action: Action; clientSeq: number }
  | { t: 'undo'; targetRevision: number }
  | { t: 'undoVote'; targetRevision: number; approve: boolean }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'joined'; playerId: PlayerId; roomState: RoomState; rejoinToken: string }
  | { t: 'room'; roomState: RoomState }
  | { t: 'deckResult'; warnings: DeckWarningKind[]; unresolved: UnresolvedLine[] }
  | { t: 'state'; state: ClientTableState }
  | { t: 'rejected'; clientSeq: number; reason: string }
  | { t: 'undoRequest'; requesterId: PlayerId; targetRevision: number; describes: string }
  | { t: 'undoResolved'; targetRevision: number; applied: boolean }
  | { t: 'error'; message: string }
  | { t: 'pong' };
