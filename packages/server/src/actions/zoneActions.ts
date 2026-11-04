// §8.2 zone actions (Phase 3), continuing from SHUFFLE_LIBRARY/DRAW in actionApplier.ts.

import type { Action, TableState } from '@command-table/common';
import {
  asNewObject,
  defaultVisibilityFor,
  detachFrom,
  placeInLibrary,
  rekeyIfHidden,
  err,
  ok,
  objectsInZone,
  requireObject,
  requirePlayer,
  withObject,
  zonesEqual,
  type ApplyResult,
} from './helpers.js';

function libraryOf(state: TableState, playerId: string) {
  return Object.values(state.objects)
    .filter((o) => 'playerId' in o.zone && o.zone.playerId === playerId && o.zone.zone === 'library')
    .sort((a, b) => a.position - b.position);
}

export function mill(state: TableState, action: Extract<Action, { t: 'MILL' }>): ApplyResult {
  if (!requirePlayer(state, action.playerId)) return err(`no such player: ${action.playerId}`);

  const toMill = libraryOf(state, action.playerId).slice(0, action.count);
  let next = state;
  for (const obj of toMill) {
    next = withObject(
      next,
      { ...obj, zone: { playerId: action.playerId, zone: 'graveyard' }, position: 0, faceVisibility: { kind: 'all' } },
      false
    );
  }
  return ok({ ...next, revision: next.revision + 1 });
}

export function peekTop(state: TableState, action: Extract<Action, { t: 'PEEK_TOP' }>): ApplyResult {
  if (!requirePlayer(state, action.playerId)) return err(`no such player: ${action.playerId}`);

  const toPeek = libraryOf(state, action.playerId).slice(0, action.count);
  let next = state;
  for (const obj of toPeek) {
    next = withObject(next, { ...obj, faceVisibility: { kind: 'players', ids: [action.playerId] } }, false);
  }
  return ok({ ...next, revision: next.revision + 1 });
}

export function reveal(state: TableState, action: Extract<Action, { t: 'REVEAL' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  return ok(withObject(state, { ...existing, faceVisibility: action.to }));
}

export function hide(state: TableState, action: Extract<Action, { t: 'HIDE' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  const faceVisibility = defaultVisibilityFor(existing.zone, existing.controllerId, existing.faceDown);
  return ok(withObject(state, { ...existing, faceVisibility }));
}

export function searchLibrary(state: TableState, action: Extract<Action, { t: 'SEARCH_LIBRARY' }>): ApplyResult {
  if (!requirePlayer(state, action.playerId)) return err(`no such player: ${action.playerId}`);

  let next = state;
  for (const obj of libraryOf(state, action.playerId)) {
    next = withObject(next, { ...obj, faceVisibility: { kind: 'players', ids: [action.playerId] } }, false);
  }
  return ok({ ...next, revision: next.revision + 1 });
}

export function moveAll(state: TableState, action: Extract<Action, { t: 'MOVE_ALL' }>): ApplyResult {
  const toMove = objectsInZone(state, action.fromZone);
  if (zonesEqual(action.fromZone, action.toZone)) return ok(state);

  let next = state;
  for (const obj of toMove) {
    // Same new-object rule as MOVE_OBJECT (CR 400.7): a board wipe shouldn't leave every
    // creature's +1/+1 counters waiting in the graveyard.
    // Visibility from the new object, which is face up (asNewObject) — not from the card as it was,
    // which left a revealed morph visible to its controller only.
    const moved = asNewObject(obj);
    next = withObject(
      detachFrom(next, obj.id),
      { ...moved, zone: action.toZone, faceVisibility: defaultVisibilityFor(action.toZone, moved.controllerId, moved.faceDown) },
      false
    );
    // Into a library, each goes under what is there, in order — not all at position 0, tied with
    // the top card (see placeInLibrary).
    if (action.toZone.zone === 'library') next = placeInLibrary(next, obj.id, Number.MAX_SAFE_INTEGER);
    next = rekeyIfHidden(next, obj, obj.id);
  }
  return ok({ ...next, revision: next.revision + 1 });
}
