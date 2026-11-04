// What "Clear markers & counters" is about to take away, said before it happens.
//
// The sweep is table-wide — every player's +1/+1s, loyalty, labels and combat markers — and is
// one click from "Create token…", so it asks first, and the question carries the size of what it
// would undo. The counting mirrors the server's own (clearMarkersAndCounters in objectActions.ts):
// summoning sickness is bookkeeping it spares, so it isn't counted here either.

import { SUMMONING_SICK_MARKER, type GameObject } from '@command-table/common';

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function clearSweepMessage(objects: Pick<GameObject, 'counters' | 'markers'>[]): string {
  let counters = 0;
  let marks = 0;
  let cards = 0;
  for (const obj of objects) {
    const objCounters = Object.values(obj.counters).reduce((sum, n) => sum + n, 0);
    const objMarks = obj.markers.filter((m) => m !== SUMMONING_SICK_MARKER).length;
    counters += objCounters;
    marks += objMarks;
    if (objCounters > 0 || objMarks > 0) cards += 1;
  }

  if (cards === 0) return 'There is nothing to clear: no card on the table carries a counter or a label.';
  return (
    `This takes ${plural(counters, 'counter', 'counters')} and ` +
    `${plural(marks, 'label or combat marker', 'labels or combat markers')} off ` +
    `${plural(cards, 'card', 'cards')} — everyone’s, not just yours.`
  );
}
