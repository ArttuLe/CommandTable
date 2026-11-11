// Shared attention: in a client with no rules enforcement, four people have to agree on what just
// happened, and a card changing zones today simply vanishes from one place and reappears in
// another. Diffing two consecutive projections is what tells a tile it was the one that moved.
//
// A client-side diff rather than a server-sent list of touched ids: you can only diff what you
// were sent, so a card you are not allowed to see cannot leak through the highlight. A
// server-sent list would have to be audited against the projection on every action.

import { isRedacted, type ObjectId, type ProjectedObject, type ZoneRef } from '@command-table/common';

/**
 * Past this many, the last action was a sweep rather than a moment: UNTAP_ALL,
 * CLEAR_MARKERS_AND_COUNTERS, PASS_TURN and an undo revert all change the whole board, and
 * flashing forty cards is noise the log already carries better.
 */
const MAX_PULSE = 8;

/** The objects that differ between two consecutive projections — what the last action touched. */
export function changedObjectIds(
  before: Record<ObjectId, ProjectedObject>,
  after: Record<ObjectId, ProjectedObject>,
): Set<ObjectId> {
  const changed = new Set<ObjectId>();
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[id];
    const b = after[id];
    // A removed object has no tile left to outline. It is kept anyway: harmless, and leaving it
    // out would mean a second code path for the one case nothing renders.
    if (!a || !b || !sameOnTile(a, b)) changed.add(id);
    if (changed.size > MAX_PULSE) return new Set();
  }
  return changed;
}

/** Only the fields a tile actually draws (see CardTile) — everything else moves nothing. */
function sameOnTile(a: ProjectedObject, b: ProjectedObject): boolean {
  // A redacted projection omits fields rather than sending them blank, so read the ones
  // only a full object has through its absence.
  const fullA = isRedacted(a) ? null : a;
  const fullB = isRedacted(b) ? null : b;
  return (
    sameZone(a.zone, b.zone) &&
    a.tapped === b.tapped &&
    a.controllerId === b.controllerId &&
    a.attachedTo === b.attachedTo &&
    sameCounters(a.counters, b.counters) &&
    sameMarkers(a.markers, b.markers) &&
    (fullA?.faceDown ?? false) === (fullB?.faceDown ?? false) &&
    (fullA?.annotation ?? null) === (fullB?.annotation ?? null)
  );
}

function sameZone(a: ZoneRef, b: ZoneRef): boolean {
  const owner = (zone: ZoneRef) => ('playerId' in zone ? zone.playerId : null);
  return a.zone === b.zone && owner(a) === owner(b);
}

function sameCounters(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function sameMarkers(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((marker, i) => marker === b[i]);
}
