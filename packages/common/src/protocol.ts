// Wire protocol, per design doc §11. Phase 1 subset only: lobby join/deck/ready/start.
// Action/undo/log messages belong to the table-state work in later phases.

import type { RoomId } from './ids.js';
import type { RoomState } from './room.js';
import type { DeckWarningKind, UnresolvedLine } from './deck.js';

export type ClientMessage =
  | { t: 'join'; roomId: RoomId; displayName: string; seat?: number; rejoinToken?: string }
  | { t: 'deck'; list: string }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'joined'; roomState: RoomState; rejoinToken: string }
  | { t: 'room'; roomState: RoomState }
  | { t: 'deckResult'; warnings: DeckWarningKind[]; unresolved: UnresolvedLine[] }
  | { t: 'error'; message: string }
  | { t: 'pong' };
