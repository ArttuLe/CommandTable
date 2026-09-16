// Applies an Action to a TableState, per design doc §3 ("the server validates only structural
// legality... never rules legality") and §8. Pure and immutable: returns a new state rather
// than mutating the one it's given, which keeps undo (§15.2, later) a matter of swapping
// snapshots. Dispatches to per-§8-subsection modules in ./actions/; MOVE_OBJECT/SHUFFLE_LIBRARY/
// DRAW/PASS_TURN (Phase 2) stay here since they predate that split.

import { randomInt as cryptoRandomInt } from 'node:crypto';
import type { Action, GameObject, TableState } from '@command-table/common';
import { fisherYatesShuffle } from './shuffle.js';
import { bumpRevision, defaultVisibilityFor, err, ok, requireObject, requirePlayer, withObject, type ApplyResult } from './actions/helpers.js';
import * as objectActions from './actions/objectActions.js';
import * as zoneActions from './actions/zoneActions.js';
import * as playerActions from './actions/playerActions.js';

export type { ApplyResult } from './actions/helpers.js';

interface ApplyDeps {
  randomInt: (exclusiveMax: number) => number;
}

const defaultDeps: ApplyDeps = { randomInt: cryptoRandomInt };

export function applyAction(state: TableState, action: Action, deps: ApplyDeps = defaultDeps): ApplyResult {
  switch (action.t) {
    case 'MOVE_OBJECT':
      return moveObject(state, action);
    case 'SHUFFLE_LIBRARY':
      return shuffleLibrary(state, action, deps);
    case 'DRAW':
      return draw(state, action);
    case 'PASS_TURN':
      return passTurn(state);

    case 'TAP':
      return objectActions.tap(state, action);
    case 'UNTAP':
      return objectActions.untap(state, action);
    case 'UNTAP_ALL':
      return objectActions.untapAll(state, action);
    case 'SET_COUNTER':
      return objectActions.setCounter(state, action);
    case 'ATTACH':
      return objectActions.attach(state, action);
    case 'UNATTACH':
      return objectActions.unattach(state, action);
    case 'SET_MARKER':
      return objectActions.setMarker(state, action);
    case 'CLEAR_MARKER':
      return objectActions.clearMarker(state, action);
    case 'CLEAR_ALL_MARKERS':
      return objectActions.clearAllMarkers(state);
    case 'TRANSFORM':
      return objectActions.transform(state, action);
    case 'TURN_FACE_DOWN':
      return objectActions.turnFaceDown(state, action);
    case 'TURN_FACE_UP':
      return objectActions.turnFaceUp(state, action);
    case 'SET_ANNOTATION':
      return objectActions.setAnnotation(state, action);
    case 'CHANGE_CONTROLLER':
      return objectActions.changeController(state, action);
    case 'CREATE_TOKEN':
      return objectActions.createToken(state, action);
    case 'CREATE_COPY':
      return objectActions.createCopy(state, action);
    case 'DELETE_OBJECT':
      return objectActions.deleteObject(state, action);

    case 'MILL':
      return zoneActions.mill(state, action);
    case 'PEEK_TOP':
      return zoneActions.peekTop(state, action);
    case 'REVEAL':
      return zoneActions.reveal(state, action);
    case 'HIDE':
      return zoneActions.hide(state, action);
    case 'SEARCH_LIBRARY':
      return zoneActions.searchLibrary(state, action);
    case 'MOVE_ALL':
      return zoneActions.moveAll(state, action);

    case 'SET_LIFE':
      return playerActions.setLife(state, action);
    case 'SET_PLAYER_COUNTER':
      return playerActions.setPlayerCounter(state, action);
    case 'SET_COMMANDER_DAMAGE':
      return playerActions.setCommanderDamage(state, action);
    case 'MULLIGAN':
      return playerActions.mulligan(state, action, deps.randomInt);
  }
}

function moveObject(state: TableState, action: Extract<Action, { t: 'MOVE_OBJECT' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) {
    return err(`no such object: ${action.objectId}`);
  }

  const faceDown = action.faceDown ?? existing.faceDown;
  const updated: GameObject = {
    ...existing,
    zone: action.toZone,
    position: action.toPosition ?? 0,
    faceDown,
    faceVisibility: defaultVisibilityFor(action.toZone, existing.controllerId, faceDown),
  };

  return ok(withObject(state, updated));
}

function shuffleLibrary(state: TableState, action: Extract<Action, { t: 'SHUFFLE_LIBRARY' }>, deps: ApplyDeps): ApplyResult {
  if (!requirePlayer(state, action.playerId)) {
    return err(`no such player: ${action.playerId}`);
  }

  const libraryObjects = Object.values(state.objects).filter(
    (o) => 'playerId' in o.zone && o.zone.playerId === action.playerId && o.zone.zone === 'library'
  );
  const shuffled = fisherYatesShuffle(libraryObjects, deps.randomInt);

  let next = state;
  shuffled.forEach((obj, index) => {
    // Also re-hides anything left visible by a prior SEARCH_LIBRARY/PEEK_TOP — a shuffle
    // scrambles the very order that made those peeks meaningful.
    next = withObject(next, { ...obj, position: index, faceVisibility: { kind: 'none' } }, false);
  });

  return ok(bumpRevision(next));
}

function draw(state: TableState, action: Extract<Action, { t: 'DRAW' }>): ApplyResult {
  if (!requirePlayer(state, action.playerId)) {
    return err(`no such player: ${action.playerId}`);
  }

  const library = Object.values(state.objects)
    .filter((o) => 'playerId' in o.zone && o.zone.playerId === action.playerId && o.zone.zone === 'library')
    .sort((a, b) => a.position - b.position);

  const toDraw = library.slice(0, action.count);

  let next = state;
  for (const obj of toDraw) {
    next = withObject(
      next,
      {
        ...obj,
        zone: { playerId: action.playerId, zone: 'hand' },
        position: 0,
        faceVisibility: { kind: 'players', ids: [action.playerId] },
      },
      false
    );
  }

  return ok(bumpRevision(next));
}

function passTurn(state: TableState): ApplyResult {
  const order = state.players;
  const currentIndex = order.findIndex((p) => p.id === state.turn.activePlayerId);
  const nextIndex = findNextActiveIndex(order, currentIndex);

  return ok(
    bumpRevision({
      ...state,
      turn: { ...state.turn, activePlayerId: order[nextIndex].id, turnNumber: state.turn.turnNumber + 1 },
    })
  );
}

function findNextActiveIndex(order: TableState['players'], fromIndex: number): number {
  for (let step = 1; step <= order.length; step++) {
    const candidate = (fromIndex + step) % order.length;
    if (order[candidate].status === 'active') {
      return candidate;
    }
  }
  return fromIndex;
}
