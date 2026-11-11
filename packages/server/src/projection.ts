// The single projection boundary: no other code path may serialize a GameObject. Every
// outbound table-state message must go through this function.

import type { ClientTableState, GameObject, ObjectId, PlayerId, ProjectedObject, TableState, Visibility } from '@command-table/common';

function isVisibleTo(visibility: Visibility, viewer: PlayerId): boolean {
  switch (visibility.kind) {
    case 'all':
      return true;
    case 'none':
      return false;
    case 'players':
      return visibility.ids.includes(viewer);
  }
}

function redact(obj: GameObject): ProjectedObject {
  return {
    id: obj.id,
    zone: obj.zone,
    controllerId: obj.controllerId,
    tapped: obj.tapped,
    counters: obj.counters,
    attachedTo: obj.attachedTo,
    markers: obj.markers,
    hidden: true,
  };
}

// Library and hand cards a viewer can't see aren't sent as redacted per-object entries at all —
// just folded into libraryCounts/handCounts (library object IDs must not be sent in order).
function isCountOnlyZone(obj: GameObject): boolean {
  return 'playerId' in obj.zone && (obj.zone.zone === 'library' || obj.zone.zone === 'hand');
}

export function projectFor(state: TableState, viewer: PlayerId): ClientTableState {
  const objects: Record<ObjectId, ProjectedObject> = {};
  const libraryCounts: Record<PlayerId, number> = {};
  const handCounts: Record<PlayerId, number> = {};

  for (const player of state.players) {
    libraryCounts[player.id] = 0;
    handCounts[player.id] = 0;
  }

  for (const obj of Object.values(state.objects)) {
    if ('playerId' in obj.zone) {
      if (obj.zone.zone === 'library') libraryCounts[obj.zone.playerId]++;
      if (obj.zone.zone === 'hand') handCounts[obj.zone.playerId]++;
    }

    const visible = isVisibleTo(obj.faceVisibility, viewer);
    if (visible) {
      objects[obj.id] = obj;
    } else if (!isCountOnlyZone(obj)) {
      objects[obj.id] = redact(obj);
    }
  }

  return {
    roomId: state.roomId,
    objects,
    libraryCounts,
    handCounts,
    players: state.players,
    turn: state.turn,
    log: state.log.filter((entry) => isVisibleTo(entry.visibility, viewer)),
    revision: state.revision,
    setupComplete: state.setupComplete,
  };
}
