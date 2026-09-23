// §8.1 object actions (Phase 3), continuing from MOVE_OBJECT in actionApplier.ts.

import { randomUUID } from 'node:crypto';
import {
  ATTACKING_MARKER,
  parseBlockMarker,
  type Action,
  type GameObject,
  type PlayerId,
  type TableState,
} from '@command-table/common';
import {
  applyCounterUpdate,
  defaultVisibilityFor,
  markersOnArrival,
  err,
  ok,
  requireObject,
  withObject,
  withoutObject,
  type ApplyResult,
} from './helpers.js';

export function tap(state: TableState, action: Extract<Action, { t: 'TAP' }>): ApplyResult {
  return setTapped(state, action.objectId, true);
}

export function untap(state: TableState, action: Extract<Action, { t: 'UNTAP' }>): ApplyResult {
  return setTapped(state, action.objectId, false);
}

function setTapped(state: TableState, objectId: string, tapped: boolean): ApplyResult {
  const existing = requireObject(state, objectId);
  if (!existing) return err(`no such object: ${objectId}`);
  return ok(withObject(state, { ...existing, tapped }));
}

export function untapAll(state: TableState, action: Extract<Action, { t: 'UNTAP_ALL' }>): ApplyResult {
  const next = untapControlledBy(state, action.playerId);
  return ok({ ...next, revision: next.revision + 1 });
}

// Shared with PASS_TURN's untap bundle (§16.3: "pass turn, with untap bundle") — doesn't bump
// revision itself so the caller can fold it into one action's single revision bump.
export function untapControlledBy(state: TableState, playerId: PlayerId): TableState {
  const toUntap = Object.values(state.objects).filter(
    (o) => o.controllerId === playerId && 'playerId' in o.zone && o.zone.zone === 'battlefield'
  );
  let next = state;
  for (const obj of toUntap) {
    next = withObject(next, { ...obj, tapped: false }, false);
  }
  return next;
}

export function setCounter(state: TableState, action: Extract<Action, { t: 'SET_COUNTER' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  const value = applyCounterUpdate(existing.counters[action.key] ?? 0, action.update);

  // A counter at zero is a counter that isn't there. Keeping the key meant a removed +1/+1 left
  // a `0` badge sitting on the tile forever, since the client draws a badge per key. Removing
  // more than are present clears it rather than going negative — no counter has a negative
  // count, and the alternative is a badge reading "-3 stun".
  const counters = { ...existing.counters };
  if (value > 0) counters[action.key] = value;
  else delete counters[action.key];

  return ok(withObject(state, { ...existing, counters }));
}

export function attach(state: TableState, action: Extract<Action, { t: 'ATTACH' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  if (!requireObject(state, action.toObjectId)) return err(`no such object: ${action.toObjectId}`);
  return ok(withObject(state, { ...existing, attachedTo: action.toObjectId }));
}

export function unattach(state: TableState, action: Extract<Action, { t: 'UNATTACH' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  return ok(withObject(state, { ...existing, attachedTo: null }));
}

export function setMarker(state: TableState, action: Extract<Action, { t: 'SET_MARKER' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  if (existing.markers.includes(action.marker)) return ok(withObject(state, existing, false));
  return ok(withObject(state, { ...existing, markers: [...existing.markers, action.marker] }));
}

export function clearMarker(state: TableState, action: Extract<Action, { t: 'CLEAR_MARKER' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  return ok(withObject(state, { ...existing, markers: existing.markers.filter((m) => m !== action.marker) }));
}

export function clearAllMarkers(state: TableState): ApplyResult {
  let next = state;
  for (const obj of Object.values(state.objects)) {
    if (obj.markers.length > 0) {
      next = withObject(next, { ...obj, markers: [] }, false);
    }
  }
  return ok({ ...next, revision: next.revision + 1 });
}

// Shared with PASS_TURN's combat sweep — doesn't bump revision itself so the caller can fold it
// into one action's single bump, like untapControlledBy above. Takes a predicate rather than a
// literal marker because block and target markers carry an id in the string (see markers.ts), so
// there is no one string to match.
export function clearMarkersFromAll(state: TableState, matches: (marker: string) => boolean): TableState {
  let next = state;
  for (const obj of Object.values(state.objects)) {
    if (obj.markers.some(matches)) {
      next = withObject(next, { ...obj, markers: obj.markers.filter((m) => !matches(m)) }, false);
    }
  }
  return next;
}

/** The same, for one player's permanents — summoning sickness wears off per player, not table-wide. */
export function clearMarkerFromControlledBy(state: TableState, playerId: PlayerId, marker: string): TableState {
  let next = state;
  for (const obj of Object.values(state.objects)) {
    if (obj.controllerId === playerId && obj.markers.includes(marker)) {
      next = withObject(next, { ...obj, markers: obj.markers.filter((m) => m !== marker) }, false);
    }
  }
  return next;
}

/**
 * Taps everything that fought this turn, as the turn ends.
 *
 * A creature that attacked or blocked is tapped by the time the turn is over, and doing it by
 * hand for every combatant was the most repetitive click in a game of Commander. Anything already
 * untapped by its controller — vigilance, an untap effect — is left alone rather than re-tapped:
 * nothing here enforces rules (§1.1), so a player's own correction has to win.
 */
export function tapCombatants(state: TableState): TableState {
  let next = state;
  for (const obj of Object.values(state.objects)) {
    if (obj.tapped || !('playerId' in obj.zone) || obj.zone.zone !== 'battlefield') continue;
    if (obj.markers.some((m) => m === ATTACKING_MARKER || parseBlockMarker(m))) {
      next = withObject(next, { ...obj, tapped: true }, false);
    }
  }
  return next;
}

export function transform(state: TableState, action: Extract<Action, { t: 'TRANSFORM' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  return ok(withObject(state, { ...existing, currentFace: existing.currentFace === 0 ? 1 : 0 }));
}

export function turnFaceDown(state: TableState, action: Extract<Action, { t: 'TURN_FACE_DOWN' }>): ApplyResult {
  return setFaceDown(state, action.objectId, true);
}

export function turnFaceUp(state: TableState, action: Extract<Action, { t: 'TURN_FACE_UP' }>): ApplyResult {
  return setFaceDown(state, action.objectId, false);
}

function setFaceDown(state: TableState, objectId: string, faceDown: boolean): ApplyResult {
  const existing = requireObject(state, objectId);
  if (!existing) return err(`no such object: ${objectId}`);
  const faceVisibility = defaultVisibilityFor(existing.zone, existing.controllerId, faceDown);
  return ok(withObject(state, { ...existing, faceDown, faceVisibility }));
}

export function setAnnotation(state: TableState, action: Extract<Action, { t: 'SET_ANNOTATION' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  return ok(withObject(state, { ...existing, annotation: action.annotation }));
}

export function changeController(state: TableState, action: Extract<Action, { t: 'CHANGE_CONTROLLER' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) return err(`no such object: ${action.objectId}`);
  const zone =
    'playerId' in existing.zone && existing.zone.zone === 'battlefield'
      ? { playerId: action.newControllerId, zone: 'battlefield' as const }
      : existing.zone;
  return ok(withObject(state, { ...existing, controllerId: action.newControllerId, zone }));
}

export function createToken(state: TableState, action: Extract<Action, { t: 'CREATE_TOKEN' }>): ApplyResult {
  const faceVisibility = defaultVisibilityFor(action.zone, action.ownerId, false);
  let next = state;
  for (let i = 0; i < action.quantity; i++) {
    const obj: GameObject = {
      id: randomUUID(),
      ownerId: action.ownerId,
      controllerId: action.ownerId,
      source: { kind: 'token', ...action.source },
      zone: action.zone,
      position: 0,
      faceVisibility,
      faceDown: false,
      currentFace: 0,
      tapped: false,
      flipped: false,
      counters: {},
      attachedTo: null,
      annotation: null,
      // A token made onto the battlefield is as summoning-sick as a creature cast onto it.
      markers: markersOnArrival(action.zone),
    };
    next = withObject(next, obj, false);
  }
  return ok({ ...next, revision: next.revision + 1 });
}

export function createCopy(state: TableState, action: Extract<Action, { t: 'CREATE_COPY' }>): ApplyResult {
  const original = requireObject(state, action.ofObjectId);
  if (!original) return err(`no such object: ${action.ofObjectId}`);
  if (original.source.kind !== 'card' && original.source.kind !== 'token') {
    return err(`cannot copy an object whose source is itself a copy reference`);
  }
  const scryfallId = 'scryfallId' in original.source ? original.source.scryfallId : undefined;
  if (!scryfallId) return err(`original object has no scryfallId to copy`);

  const copy: GameObject = {
    id: randomUUID(),
    ownerId: action.ownerId,
    controllerId: action.ownerId,
    source: { kind: 'copy', ofObjectId: action.ofObjectId, scryfallId },
    zone: action.zone,
    position: 0,
    faceVisibility: defaultVisibilityFor(action.zone, action.ownerId, false),
    faceDown: false,
    currentFace: 0,
    tapped: false,
    flipped: false,
    counters: {},
    attachedTo: null,
    annotation: null,
    markers: markersOnArrival(action.zone),
  };
  return ok(withObject(state, copy));
}

export function deleteObject(state: TableState, action: Extract<Action, { t: 'DELETE_OBJECT' }>): ApplyResult {
  if (!requireObject(state, action.objectId)) return err(`no such object: ${action.objectId}`);
  return ok({ ...withoutObject(state, action.objectId), revision: state.revision + 1 });
}
