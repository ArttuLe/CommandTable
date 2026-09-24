// Markers are freeform strings (§8.1) and stay that way — but a few of them are understood by
// both ends, and this is where the two agree on what they mean.
//
// Combat is the reason the list grew. §7.3 is explicit that there is no combat state in the
// model: "Attackers and blockers are `markers` on objects, set and cleared by players." Blocking
// still has to say *which* attacker is being blocked, so that relationship is
// encoded into the marker string rather than added to GameObject as a field. That keeps every
// existing mechanism working untouched — the server syncs markers already, undo covers them
// already, the projection ships them already — at the cost of a parse step, which lives here so
// no component invents its own.

import type { ObjectId } from './objects.js';

/** The client draws a red ring around anything carrying it; PASS_TURN sweeps it up. */
export const ATTACKING_MARKER = 'attacking';

/**
 * Set by the server when a permanent arrives on a battlefield, cleared when its controller's
 * next turn begins. The server can't tell a creature from a land — it has no card data, by
 * design — so it marks everything and the client only draws the indicator on creatures.
 */
export const SUMMONING_SICK_MARKER = 'summoning-sick';

const BLOCK_PREFIX = 'block:';
const TARGET_PREFIX = 'target:';

/**
 * `block:<attackerId>` — which attacker this creature is blocking.
 *
 * Carries no ordering. It used to, drawn as "(1) (2)" on the arrows, on the theory that damage
 * assignment needs a declared sequence; the arrows already say who is blocking whom, and the
 * numbers were one more thing to keep straight as blockers came and went.
 */
export function blockMarker(attackerId: ObjectId): string {
  return `${BLOCK_PREFIX}${attackerId}`;
}

export function parseBlockMarker(marker: string): ObjectId | null {
  if (!marker.startsWith(BLOCK_PREFIX)) return null;
  return marker.slice(BLOCK_PREFIX.length) || null;
}

/** `target:<objectId>` — what a spell or ability on the stack is pointed at. */
export function targetMarker(objectId: ObjectId): string {
  return `${TARGET_PREFIX}${objectId}`;
}

export function parseTargetMarker(marker: string): ObjectId | null {
  if (!marker.startsWith(TARGET_PREFIX)) return null;
  return marker.slice(TARGET_PREFIX.length) || null;
}

/**
 * Markers that belong to a turn rather than to a card, and so are swept when one ends.
 *
 * Summoning sickness is deliberately not one of them: it is cleared per-player when that
 * player's own turn comes round, not table-wide at every pass.
 */
export function isCombatMarker(marker: string): boolean {
  return marker === ATTACKING_MARKER || marker.startsWith(BLOCK_PREFIX) || marker.startsWith(TARGET_PREFIX);
}
