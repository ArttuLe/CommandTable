// Lobby-scoped state, per design doc §14.1. Distinct from the in-game TableState (§7.3),
// which doesn't exist until the host starts the game (Phase 2).

import type { PlayerId, RoomId } from './ids.js';

export type DeckStatus = 'none' | 'ok' | 'warnings';

export interface SeatInfo {
  seat: number;
  playerId: PlayerId | null;
  displayName: string | null;
  connected: boolean;
  ready: boolean;
  deckStatus: DeckStatus;
}

export interface RoomState {
  roomId: RoomId;
  hostId: PlayerId | null;
  seats: SeatInfo[];
  started: boolean;
}
