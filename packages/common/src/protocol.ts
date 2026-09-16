// Wire protocol, per design doc §11. Phase 1 (lobby) + Phase 2 (table state) subset.
// Undo/log messages are later phases.

import type { RoomId } from './ids.js';
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
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'joined'; roomState: RoomState; rejoinToken: string }
  | { t: 'room'; roomState: RoomState }
  | { t: 'deckResult'; warnings: DeckWarningKind[]; unresolved: UnresolvedLine[] }
  | { t: 'state'; state: ClientTableState }
  | { t: 'rejected'; clientSeq: number; reason: string }
  | { t: 'error'; message: string }
  | { t: 'pong' };
