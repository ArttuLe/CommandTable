// §12's commander replacement: a commander heading to the graveyard or exile may be put into the
// command zone instead, and it's the owner's choice every time — so this offers, never moves.
//
// It reads the table rather than watching for the moment it died: the offer stands for as long as
// the commander is sitting there, which means it survives a refresh, a reconnect, and a player
// who was looking at their hand when it happened. A toast would have expired in five seconds.

import type { ObjectId, ProjectedObject } from '@command-table/common';

export type ReplaceableZone = 'graveyard' | 'exile';

export interface CommanderPrompt {
  objectId: ObjectId;
  zone: ReplaceableZone;
}

/**
 * Dismissals are keyed by the zone the commander was in when you waved the offer away, so
 * leaving it in the graveyard stays quiet — but the same commander later being exiled from
 * there is a new decision, and asks again.
 */
export function commanderPrompts(
  objects: Record<ObjectId, ProjectedObject>,
  commanderIds: readonly ObjectId[],
  dismissed: Record<ObjectId, ReplaceableZone>
): CommanderPrompt[] {
  const prompts: CommanderPrompt[] = [];
  for (const objectId of commanderIds) {
    const zone = replaceableZoneOf(objects[objectId]);
    if (zone && dismissed[objectId] !== zone) prompts.push({ objectId, zone });
  }
  return prompts;
}

function replaceableZoneOf(obj: ProjectedObject | undefined): ReplaceableZone | null {
  if (!obj || !('playerId' in obj.zone)) return null;
  return obj.zone.zone === 'graveyard' || obj.zone.zone === 'exile' ? obj.zone.zone : null;
}
