// Reading combat off the markers.
//
// None of this is a new data structure: attacking, blocking and targeting are all `markers`
// (no combat state in the model), with the block and target ones carrying the other end's
// id inside the string — see packages/common/src/markers.ts, which owns that format. This module
// is the client's read side: it turns a bag of marker strings into the relationships the arrows
// and the badges are drawn from, in one place, so no component parses a marker itself.

import {
  ATTACKING_MARKER,
  SUMMONING_SICK_MARKER,
  parseBlockMarker,
  parseTargetMarker,
  type ObjectId,
  type PlayerId,
  type ProjectedObject,
} from '@command-table/common';

export { ATTACKING_MARKER, SUMMONING_SICK_MARKER };

export function isAttacking(obj: Pick<ProjectedObject, 'markers'>): boolean {
  return obj.markers.includes(ATTACKING_MARKER);
}

export function isSummoningSick(obj: Pick<ProjectedObject, 'markers'>): boolean {
  return obj.markers.includes(SUMMONING_SICK_MARKER);
}

/** Every attacker this creature has been declared against. */
export function blocksOf(obj: Pick<ProjectedObject, 'markers'>): ObjectId[] {
  return obj.markers.map(parseBlockMarker).filter((attackerId) => attackerId !== null);
}

/**
 * `mine` is whose creature is at the near end of the arrow, and it is here rather than in the
 * component because it is the same question the mats already answer: your board is the accent
 * colour, everyone else's is the turn colour. A blocker drawn in the colour of the board it sits
 * on says whose blocker it is without a label.
 */
export interface Relation {
  kind: 'block' | 'target';
  fromId: ObjectId;
  toId: ObjectId;
  mine: boolean;
}

/**
 * Every arrow the table should be drawing, as a flat list.
 *
 * A relation whose other end is gone is dropped rather than drawn to nowhere: markers outlive the
 * object they point at — a blocked attacker can die before the turn ends — and there is nothing
 * to clean them up until PASS_TURN sweeps.
 */
export function combatRelations(objects: Record<ObjectId, ProjectedObject>, myId: PlayerId): Relation[] {
  const relations: Relation[] = [];

  for (const obj of Object.values(objects)) {
    const mine = obj.controllerId === myId;
    for (const marker of obj.markers) {
      const attackerId = parseBlockMarker(marker);
      if (attackerId) {
        if (objects[attackerId]) {
          relations.push({ kind: 'block', fromId: obj.id, toId: attackerId, mine });
        }
        continue;
      }

      const targetId = parseTargetMarker(marker);
      if (targetId && objects[targetId]) {
        relations.push({ kind: 'target', fromId: obj.id, toId: targetId, mine });
      }
    }
  }

  return relations;
}

/**
 * Whether a marker is one the players wrote, as opposed to machinery.
 *
 * Attacking is a red ring, summoning sickness is a corner mark, and block/target markers are
 * arrows — none of them should also appear as a text pill or in the "Remove label" list. Shared
 * so the tile and the context menu can't drift about what counts as a label.
 */
export function isLabelMarker(marker: string): boolean {
  return (
    marker !== ATTACKING_MARKER &&
    marker !== SUMMONING_SICK_MARKER &&
    !parseBlockMarker(marker) &&
    !parseTargetMarker(marker)
  );
}
