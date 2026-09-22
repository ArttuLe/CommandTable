// Where each player's board sits on the plane, and which way it faces.
//
// Two rules drive everything here, both of them borrowed from how a physical table works:
//
// 1. You are always bottom-left, and the other players run clockwise from you in turn order.
//    Turn order is `PlayerState.seat` (randomized when the table is built), so the player who
//    acts after you is the one to your left — the same relationship you'd have sitting down.
// 2. A board's lands hug its *outer* edge. Lands sit in front of their owner; creatures advance
//    toward the middle of the table. So top-row boards put lands at the top, bottom-row boards
//    put lands at the bottom, and the crossroads in the middle stays the contested space.
//
// Two players get a vertical stack rather than a quadrant — there's no "clockwise" worth
// modeling with one opponent, and half an empty grid just makes both boards smaller.

import type { PlayerId } from '@command-table/common';

export type GridArea = 'bottom-left' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom' | 'top';
export type LandsSide = 'top' | 'bottom';

export interface Seat {
  playerId: PlayerId;
  gridArea: GridArea;
  landsSide: LandsSide;
}

/** Clockwise around the table starting from the local player's seat. */
const QUADRANTS: GridArea[] = ['bottom-left', 'top-left', 'top-right', 'bottom-right'];
const STACKED: GridArea[] = ['bottom', 'top'];

export function seating(
  players: readonly { id: PlayerId; seat: number }[],
  myId: PlayerId
): Seat[] {
  const byTurnOrder = [...players].sort((a, b) => a.seat - b.seat);
  const mine = byTurnOrder.findIndex((p) => p.id === myId);
  const clockwise = [...byTurnOrder.slice(mine), ...byTurnOrder.slice(0, mine)];

  const areas = clockwise.length <= 2 ? STACKED : QUADRANTS;
  return clockwise.map((player, i) => {
    const gridArea = areas[i];
    return { playerId: player.id, gridArea, landsSide: landsSideOf(gridArea) };
  });
}

function landsSideOf(area: GridArea): LandsSide {
  return area.startsWith('top') ? 'top' : 'bottom';
}
