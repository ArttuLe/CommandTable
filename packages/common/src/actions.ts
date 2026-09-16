// Player action catalog, per design doc §8 and §10. Phase 2 covered MOVE_OBJECT/SHUFFLE_LIBRARY/
// DRAW/PASS_TURN. Phase 3 adds the rest of §8 except ROLL_DICE/FLIP_COIN/CONCEDE/SAY, which the
// doc ties to the game log ("results go into the public log") — deferred to Phase 4 alongside it.
//
// Two doc actions are deliberately collapsed here rather than given one type each:
// - SCRY/SURVEIL/PEEK_TOP (§8.2) are the same server primitive (reveal top N to the owner);
//   the difference between scry/surveil/peek is purely client-side labeling of what the player
//   does next with MOVE_OBJECT, so they share PEEK_TOP.
// - SET_LIFE takes `playerIds: PlayerId[]` instead of a single id, since §8.3 explicitly
//   requires bulk support ("must support bulk (Blasphemous Act hitting four players)") — a
//   single-player change is just an array of length 1, rather than a second near-duplicate action.

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
  | { t: 'CLEAR_ALL_MARKERS' }
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
  | { t: 'MULLIGAN'; playerId: PlayerId };
