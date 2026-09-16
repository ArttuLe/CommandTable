// Applies a Phase 2 Action to a TableState, per design doc §3 ("the server validates only
// structural legality... never rules legality") and §8. Pure and immutable: returns a new
// state rather than mutating the one it's given, which keeps undo (§15.2, later) a matter of
// swapping snapshots.

import { randomInt as cryptoRandomInt } from 'node:crypto';
import type { Action, GameObject, TableState, Visibility, ZoneRef } from '@command-table/common';
import { fisherYatesShuffle } from './shuffle.js';

export type ApplyResult = { ok: true; state: TableState } | { ok: false; reason: string };

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
  }
}

function moveObject(state: TableState, action: Extract<Action, { t: 'MOVE_OBJECT' }>): ApplyResult {
  const existing = state.objects[action.objectId];
  if (!existing) {
    return { ok: false, reason: `no such object: ${action.objectId}` };
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
  if (!state.players.some((p) => p.id === action.playerId)) {
    return { ok: false, reason: `no such player: ${action.playerId}` };
  }

  const libraryObjects = Object.values(state.objects).filter(
    (o) => 'playerId' in o.zone && o.zone.playerId === action.playerId && o.zone.zone === 'library'
  );
  const shuffled = fisherYatesShuffle(libraryObjects, deps.randomInt);

  let next = state;
  shuffled.forEach((obj, index) => {
    next = withObject(next, { ...obj, position: index }, false);
  });

  return ok(bumpRevision(next));
}

function draw(state: TableState, action: Extract<Action, { t: 'DRAW' }>): ApplyResult {
  if (!state.players.some((p) => p.id === action.playerId)) {
    return { ok: false, reason: `no such player: ${action.playerId}` };
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

function defaultVisibilityFor(zone: ZoneRef, controllerId: string, faceDown: boolean): Visibility {
  if (!('playerId' in zone)) {
    // stack: shared and public. limbo: transitional, defaults to hidden as the safest choice.
    return zone.zone === 'stack' ? { kind: 'all' } : { kind: 'none' };
  }
  switch (zone.zone) {
    case 'library':
      return { kind: 'none' };
    case 'hand':
      return { kind: 'players', ids: [zone.playerId] };
    case 'battlefield':
    case 'exile':
      return faceDown ? { kind: 'players', ids: [controllerId] } : { kind: 'all' };
    case 'graveyard':
    case 'commandZone':
      return { kind: 'all' };
  }
}

function withObject(state: TableState, obj: GameObject, bump = true): TableState {
  const next: TableState = { ...state, objects: { ...state.objects, [obj.id]: obj } };
  return bump ? bumpRevision(next) : next;
}

function bumpRevision(state: TableState): TableState {
  return { ...state, revision: state.revision + 1 };
}

function ok(state: TableState): ApplyResult {
  return { ok: true, state };
}
