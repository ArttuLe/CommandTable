// Shared plumbing for action modules, split out of actionApplier.ts so each §8 subsection
// (object/zone/player actions) can live in its own file without duplicating this.

import { randomUUID } from 'node:crypto';
import { SUMMONING_SICK_MARKER, parseBlockMarker, parseTargetMarker, type CounterUpdate, type GameObject, type LogKind, type PlayerId, type TableState, type Visibility, type ZoneRef } from '@command-table/common';

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
    // stack: shared and public — unless face down (a morph being cast), which only its controller
    // sees, as on the battlefield. limbo: transitional, defaults to hidden as the safest choice.
    if (zone.zone === 'limbo') return { kind: 'none' };
    return faceDown ? { kind: 'players', ids: [controllerId] } : { kind: 'all' };
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
    // Face up unless the move says otherwise (CR 708.9): a dead morph is revealed, and a foretold
    // card cast out of exile is cast face up.
    faceDown: false,
    currentFace: 0,
    counters: {},
    markers: [],
    annotation: null,
    attachedTo: null,
  };
}

/**
 * The markers an object is born with when it arrives in a zone.
 *
 * Only the battlefield gives it one: anything that just turned up there is summoning-sick until
 * its controller's next turn starts (PASS_TURN clears it). Marked without asking what the card
 * is, because this layer has no card data — the client draws the indicator on creatures only.
 */
export function markersOnArrival(zone: ZoneRef): string[] {
  return 'playerId' in zone && zone.zone === 'battlefield' ? [SUMMONING_SICK_MARKER] : [];
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

/**
 * Puts a card at an index of the library it just joined (or moved within), and renumbers that
 * library 0..n-1. `toPosition` is an index, not a sort key: written straight into `position`,
 * "top" (0) tied with the card already on top — and the stable sort kept the old one there — while
 * "bottom" (the card count) landed mid-library once a draw had left positions starting above 0.
 */
export function placeInLibrary(state: TableState, objectId: string, index: number): TableState {
  const moved = state.objects[objectId];
  const others = Object.values(state.objects)
    .filter((o) => o.id !== objectId && zonesEqual(o.zone, moved.zone))
    .sort((a, b) => a.position - b.position);
  const at = Math.max(0, Math.min(index, others.length));
  const ordered = [...others.slice(0, at), moved, ...others.slice(at)];
  return ordered.reduce(
    (next, obj, position) => (obj.position === position ? next : withObject(next, { ...obj, position }, false)),
    state
  );
}

function seenBy(visibility: Visibility, playerIds: PlayerId[]): PlayerId[] {
  switch (visibility.kind) {
    case 'all':
      return playerIds;
    case 'players':
      return visibility.ids;
    case 'none':
      return [];
  }
}

/**
 * Gives an object a fresh id if `before` → its current state took it out of anyone's sight.
 *
 * §9.3: opening dev tools shouldn't spoil a game. Ids are what every client tracks objects by, and
 * the projection keeps a hidden object's id — so a card everyone saw on the battlefield, bounced to
 * a hand or turned face down under the same id, was still plainly that card to anyone who looked.
 * A new id makes it a new object as far as anyone watching can tell, which is what CR 400.7 says
 * it is anyway. A card coming *into* view keeps its id: every client already follows it.
 *
 * What was keyed by the old id comes along: the commander bookkeeping. Combat markers on other
 * objects that pointed at it are dropped — what they pointed at has left.
 */
export function rekeyIfHidden(state: TableState, before: GameObject, objectId: string): TableState {
  const after = state.objects[objectId];
  const playerIds = state.players.map((p) => p.id);
  const stillSees = new Set(seenBy(after.faceVisibility, playerIds));
  if (seenBy(before.faceVisibility, playerIds).every((id) => stillSees.has(id))) return state;

  const fresh = randomUUID();
  const pointsHere = (marker: string) => parseBlockMarker(marker) === objectId || parseTargetMarker(marker) === objectId;
  const objects: TableState['objects'] = {};
  for (const obj of Object.values(state.objects)) {
    if (obj.id === objectId) objects[fresh] = { ...obj, id: fresh };
    else objects[obj.id] = obj.markers.some(pointsHere) ? { ...obj, markers: obj.markers.filter((m) => !pointsHere(m)) } : obj;
  }
  const renamed = <T>(byId: Record<string, T>): Record<string, T> => {
    if (!(objectId in byId)) return byId;
    const { [objectId]: value, ...rest } = byId;
    return { ...rest, [fresh]: value };
  };
  const players = state.players.map((p) => ({
    ...p,
    commanderIds: p.commanderIds.map((id) => (id === objectId ? fresh : id)),
    commanderCastCount: renamed(p.commanderCastCount),
    commanderDamageTaken: renamed(p.commanderDamageTaken),
  }));
  return { ...state, objects, players };
}
