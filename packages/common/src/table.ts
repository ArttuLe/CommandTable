// In-game table state. Distinct from the lobby's RoomState (room.ts), which is what exists
// before the host starts the game.

import type { PlayerId } from './ids.js';
import type { GameObject, ObjectId, Visibility } from './objects.js';
import type { LogEntry } from './log.js';

export type Phase = 'main' | 'combat' | 'end';

export interface TurnTracker {
  turnNumber: number;
  activePlayerId: PlayerId;
  phase: Phase;
}

export interface PlayerState {
  id: PlayerId;
  displayName: string;
  seat: number;
  connected: boolean;

  life: number;
  counters: Record<string, number>;

  commanderDamageTaken: Record<ObjectId, number>;
  commanderCastCount: Record<ObjectId, number>;

  commanderIds: ObjectId[];
  status: 'active' | 'conceded' | 'eliminated';

  /** Whether this player has settled on their opening hand — see `TableState.setupComplete`. */
  keptHand: boolean;
}

export interface TableState {
  roomId: string;
  objects: Record<ObjectId, GameObject>;
  players: PlayerState[];
  turn: TurnTracker;
  log: LogEntry[];
  revision: number;
  createdAt: number;

  /**
   * False between the deal and the host starting play — the mulligan step.
   *
   * Dealing opening hands used to drop straight into turn 1, which left no moment to mulligan
   * in: the game was already underway, so a mulligan was something you did *during* your first
   * turn. This marks out that moment. It gates nothing — the host can begin whenever
   * they like, whatever anyone has or hasn't kept — it only tells the client to show the
   * mulligan step instead of the usual turn chrome.
   */
  setupComplete: boolean;
}

// The redacted shape sent to a client for an object it may not see:
// omit `source`, `ownerId`, and `annotation` entirely rather than send them with a flag.
export interface RedactedObject {
  id: ObjectId;
  zone: GameObject['zone'];
  controllerId: PlayerId;
  tapped: boolean;
  counters: Record<string, number>;
  attachedTo: ObjectId | null;
  markers: string[];
  hidden: true;
}

export type ProjectedObject = GameObject | RedactedObject;

export interface ClientTableState {
  roomId: string;
  objects: Record<ObjectId, ProjectedObject>;
  libraryCounts: Record<PlayerId, number>;
  handCounts: Record<PlayerId, number>;
  players: PlayerState[];
  turn: TurnTracker;
  log: LogEntry[];
  revision: number;
  setupComplete: boolean;
}

export function isRedacted(obj: ProjectedObject): obj is RedactedObject {
  return 'hidden' in obj && obj.hidden === true;
}
