// Player action catalog. ROLL_DICE/FLIP_COIN/CONCEDE/SAY put their results into the public game
// log, so they were added alongside the log system.
//
// Two actions are deliberately collapsed here rather than given one type each:
// - SCRY/SURVEIL/PEEK_TOP are the same server primitive (reveal top N to the owner);
//   the difference between scry/surveil/peek is purely client-side labeling of what the player
//   does next with MOVE_OBJECT, so they share PEEK_TOP.
// - SET_LIFE takes `playerIds: PlayerId[]` instead of a single id, since life changes must
//   support bulk (Blasphemous Act hitting four players) — a single-player change is just an
//   array of length 1, rather than a second near-duplicate action.

import type { PlayerId } from './ids.js';
import type { AdhocFace, ObjectId, Visibility, ZoneRef } from './objects.js';

export type CounterUpdate = { mode: 'set'; amount: number } | { mode: 'delta'; amount: number };

export type Action =
  | { t: 'MOVE_OBJECT'; objectId: ObjectId; toZone: ZoneRef; toPosition?: number; faceDown?: boolean }
  | { t: 'SHUFFLE_LIBRARY'; playerId: PlayerId }
  | { t: 'DRAW'; playerId: PlayerId; count: number }
  | { t: 'PASS_TURN' }
  | { t: 'TAP'; objectId: ObjectId }
  | { t: 'UNTAP'; objectId: ObjectId }
  | { t: 'UNTAP_ALL'; playerId: PlayerId }
  | { t: 'SET_COUNTER'; objectId: ObjectId; key: string; update: CounterUpdate }
  | { t: 'ATTACH'; objectId: ObjectId; toObjectId: ObjectId }
  | { t: 'UNATTACH'; objectId: ObjectId }
  | { t: 'SET_MARKER'; objectId: ObjectId; marker: string }
  | { t: 'CLEAR_MARKER'; objectId: ObjectId; marker: string }
  // A table-wide reset of everything players stick on cards: labels, combat markers and counters
  // alike. Summoning sickness is spared — the server sets and clears it on its own (see
  // markers.ts), so it is machinery rather than something a player put there to be cleaned up.
  | { t: 'CLEAR_MARKERS_AND_COUNTERS' }
  | { t: 'TRANSFORM'; objectId: ObjectId }
  | { t: 'TURN_FACE_DOWN'; objectId: ObjectId }
  | { t: 'TURN_FACE_UP'; objectId: ObjectId }
  | { t: 'SET_ANNOTATION'; objectId: ObjectId; annotation: string | null }
  | { t: 'CHANGE_CONTROLLER'; objectId: ObjectId; newControllerId: PlayerId }
  | {
      t: 'CREATE_TOKEN';
      ownerId: PlayerId;
      zone: ZoneRef;
      source: { scryfallId: string } | { adhoc: AdhocFace };
      quantity: number;
    }
  | { t: 'CREATE_COPY'; ofObjectId: ObjectId; ownerId: PlayerId; zone: ZoneRef }
  | { t: 'DELETE_OBJECT'; objectId: ObjectId }
  | { t: 'MILL'; playerId: PlayerId; count: number }
  | { t: 'PEEK_TOP'; playerId: PlayerId; count: number }
  | { t: 'REVEAL'; objectId: ObjectId; to: Visibility }
  | { t: 'HIDE'; objectId: ObjectId }
  | { t: 'SEARCH_LIBRARY'; playerId: PlayerId }
  | { t: 'MOVE_ALL'; fromZone: ZoneRef; toZone: ZoneRef }
  | { t: 'SET_LIFE'; playerIds: PlayerId[]; update: CounterUpdate }
  | { t: 'SET_PLAYER_COUNTER'; playerId: PlayerId; key: string; update: CounterUpdate }
  | { t: 'SET_COMMANDER_DAMAGE'; toPlayerId: PlayerId; fromCommanderObjectId: ObjectId; update: CounterUpdate }
  | { t: 'MULLIGAN'; playerId: PlayerId }
  // The two halves of the opening-hand step (see TableState.setupComplete). Actions rather than
  // protocol messages, so they go through the same log and undo machinery as everything else —
  // a host who begins play early can be rewound like any other misclick.
  | { t: 'KEEP_HAND'; playerId: PlayerId }
  | { t: 'BEGIN_PLAY' }
  | { t: 'ROLL_DICE'; playerId: PlayerId; sides: number }
  | { t: 'FLIP_COIN'; playerId: PlayerId }
  | { t: 'CONCEDE'; playerId: PlayerId }
  | { t: 'SAY'; playerId: PlayerId; text: string };
