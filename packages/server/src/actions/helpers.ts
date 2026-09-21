// Shared plumbing for action modules, split out of actionApplier.ts so each §8 subsection
// (object/zone/player actions) can live in its own file without duplicating this.

import type { CounterUpdate, GameObject, LogKind, PlayerId, TableState, Visibility, ZoneRef } from '@command-table/common';

// `log` lets an action override the generic, action-type-derived log description from
// actionDescriptions.ts — needed when the log text depends on the *outcome*, not just the
// action's input (ROLL_DICE/FLIP_COIN's result, CONCEDE's life total at the time). The central
// applyAction wrapper in actionApplier.ts consumes this and turns it into a LogEntry; it never
// reaches callers of applyAction.
export type ApplyResult =
  | { ok: true; state: TableState; log?: { text: string; visibility?: Visibility; kind?: LogKind } }
  | { ok: false; reason: string };

export function ok(state: TableState, log?: { text: string; visibility?: Visibility; kind?: LogKind }): ApplyResult {
  return { ok: true, state, log };
}

export function err(reason: string): ApplyResult {
  return { ok: false, reason };
}

export function requireObject(state: TableState, objectId: string): GameObject | undefined {
  return state.objects[objectId];
}

export function requirePlayer(state: TableState, playerId: PlayerId) {
  return state.players.find((p) => p.id === playerId);
}

export function objectsInZone(state: TableState, zone: ZoneRef): GameObject[] {
  return Object.values(state.objects).filter((o) => zonesEqual(o.zone, zone));
}

export function zonesEqual(a: ZoneRef, b: ZoneRef): boolean {
  if ('playerId' in a && 'playerId' in b) {
    return a.playerId === b.playerId && a.zone === b.zone;
  }
  if (!('playerId' in a) && !('playerId' in b)) {
    return a.zone === b.zone;
  }
  return false;
}

export function withObject(state: TableState, obj: GameObject, bump = true): TableState {
  const next: TableState = { ...state, objects: { ...state.objects, [obj.id]: obj } };
  return bump ? bumpRevision(next) : next;
}

export function withoutObject(state: TableState, objectId: string): TableState {
  const { [objectId]: _removed, ...rest } = state.objects;
  return { ...state, objects: rest };
}

export function bumpRevision(state: TableState): TableState {
  return { ...state, revision: state.revision + 1 };
}

export function applyCounterUpdate(current: number, update: CounterUpdate): number {
  return update.mode === 'set' ? update.amount : current + update.amount;
}

export function defaultVisibilityFor(zone: ZoneRef, controllerId: PlayerId, faceDown: boolean): Visibility {
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

/**
 * A card that changes zones becomes a new object (CR 400.7): it loses the state it accumulated
 * where it was. Nothing here enforces rules, but the alternative is every player undoing this by
 * hand — a creature that died wearing three +1/+1 counters used to come back from the graveyard
 * still wearing them.
 *
 * `faceDown`/`faceVisibility` are deliberately absent: MOVE_OBJECT already decides those from
 * the destination zone. Only a *change* of zone counts — reordering a library (see the client's
 * libraryMoves.ts) moves an object without making it a new one.
 */
export function asNewObject(obj: GameObject): GameObject {
  return {
    ...obj,
    controllerId: obj.ownerId,
    tapped: false,
    flipped: false,
    currentFace: 0,
    counters: {},
    markers: [],
    annotation: null,
    attachedTo: null,
  };
}

/** Anything attached to `objectId` comes loose — otherwise the reference dangles. */
export function detachFrom(state: TableState, objectId: string): TableState {
  let next = state;
  for (const obj of Object.values(state.objects)) {
    if (obj.attachedTo === objectId) {
      next = withObject(next, { ...obj, attachedTo: null }, false);
    }
  }
  return next;
}
