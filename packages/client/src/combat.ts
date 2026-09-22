// The attacking flag.
//
// It's an ordinary marker (§8, SET_MARKER) rather than a new action or object field: the server
// already syncs markers to every player, undo already covers them, and PASS_TURN sweeps this one
// up when the turn ends. The client just gives it a dedicated toggle and a red border, since
// "who is attacking" is the one marker the whole table reads at a glance.

import { ATTACKING_MARKER, type ProjectedObject } from '@command-table/common';

export { ATTACKING_MARKER };

export function isAttacking(obj: Pick<ProjectedObject, 'markers'>): boolean {
  return obj.markers.includes(ATTACKING_MARKER);
}
