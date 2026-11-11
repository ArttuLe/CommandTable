// Where each player's board sits on the plane, and which way it faces.
//
// Two rules drive everything here, both of them borrowed from how a physical table works:
//
// 1. You are always bottom-left, and the other players run clockwise from you in turn order.
//    Turn order is the order of the players list, shuffled when the table is built, so the
//    player who acts after you is the one to your left — the same relationship you'd have sitting
//    down. Not `PlayerState.seat`: that is the lobby seat, which the shuffle leaves as it was.
// 2. A board's lands hug its *outer* edge. Lands sit in front of their owner; creatures advance
//    toward the middle of the table. So top-row boards put lands at the top, bottom-row boards
//    put lands at the bottom, and the middle of the table stays the contested space.
//    The player rail beside each board (PlayerRail.tsx) obeys the same rule in both directions:
//    it takes the outer *column* and hugs the outer *row*, so a player's own readouts sit at the
//    far corner of their own mat, never in the space where the mats meet.
//
// Two players get a vertical stack rather than a quadrant — there's no "clockwise" worth
// modeling with one opponent, and half an empty grid just makes both boards smaller.

import type { PlayerId } from '@command-table/common';

export type GridArea = 'bottom-left' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom' | 'top';
export type LandsSide = 'top' | 'bottom';
export type RailSide = 'left' | 'right';

export interface Seat {
  playerId: PlayerId;
  gridArea: GridArea;
  landsSide: LandsSide;
  /** Which flank the player rail takes. Its vertical anchor is `landsSide` — the same outer edge. */
  railSide: RailSide;
}

/** Clockwise around the table starting from the local player's seat. */
const QUADRANTS: GridArea[] = ['bottom-left', 'top-left', 'top-right', 'bottom-right'];
const STACKED: GridArea[] = ['bottom', 'top'];

export function seating(
  /** In turn order, which is the order the server keeps them in. */
  players: readonly { id: PlayerId }[],
  myId: PlayerId
): Seat[] {
  const mine = players.findIndex((p) => p.id === myId);
  const clockwise = [...players.slice(mine), ...players.slice(0, mine)];

  const areas = clockwise.length <= 2 ? STACKED : QUADRANTS;
  return clockwise.map((player, i) => {
    const gridArea = areas[i];
    return {
      playerId: player.id,
      gridArea,
      landsSide: landsSideOf(gridArea),
      railSide: railSideOf(gridArea),
    };
  });
}

function landsSideOf(area: GridArea): LandsSide {
  return area.startsWith('top') ? 'top' : 'bottom';
}

// The stacked areas are one column wide, so there is no outer flank to pick and both rails go
// left — which is also the side the four-player table gives the seat you occupy.
function railSideOf(area: GridArea): RailSide {
  return area.endsWith('-right') ? 'right' : 'left';
}
