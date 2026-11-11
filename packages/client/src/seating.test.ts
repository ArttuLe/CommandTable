import { describe, expect, it } from 'vitest';
import { seating } from './seating.js';

// Input is deliberately narrower than PlayerState — seating only cares about identity, and the
// list's order is the turn order — so these fixtures stay readable. Structural typing lets real
// PlayerState[] through.
const p = (id: string) => ({ id });

describe('seating', () => {
  it('puts the local player bottom-left and the rest clockwise in turn order', () => {
    const result = seating([p('me'), p('b'), p('c'), p('d')], 'me');

    expect(result.map((s) => [s.playerId, s.gridArea])).toEqual([
      ['me', 'bottom-left'],
      ['b', 'top-left'],
      ['c', 'top-right'],
      ['d', 'bottom-right'],
    ]);
  });

  it('wraps turn order around when the local player is not seat 0', () => {
    const result = seating([p('a'), p('b'), p('me'), p('d')], 'me');

    expect(result.map((s) => [s.playerId, s.gridArea])).toEqual([
      ['me', 'bottom-left'],
      ['d', 'top-left'],
      ['a', 'top-right'],
      ['b', 'bottom-right'],
    ]);
  });

  it('leaves the bottom-right quadrant empty in a three-player game', () => {
    const result = seating([p('me'), p('b'), p('c')], 'me');

    expect(result.map((s) => s.gridArea)).toEqual(['bottom-left', 'top-left', 'top-right']);
  });

  it('stacks a two-player game vertically instead of using a quadrant', () => {
    const result = seating([p('me'), p('b')], 'me');

    expect(result.map((s) => [s.playerId, s.gridArea])).toEqual([
      ['me', 'bottom'],
      ['b', 'top'],
    ]);
  });

  it('orients every board so its lands hug the outer edge', () => {
    const four = seating([p('me'), p('b'), p('c'), p('d')], 'me');
    expect(four.map((s) => s.landsSide)).toEqual(['bottom', 'top', 'top', 'bottom']);

    const two = seating([p('me'), p('b')], 'me');
    expect(two.map((s) => s.landsSide)).toEqual(['bottom', 'top']);
  });

  // The rail carries what the board header used to, so it follows the same outer-edge rule the
  // lands do — outer column as well as outer row, which is what keeps it off the contested middle.
  it('puts every player rail on the outer flank of its column', () => {
    const four = seating([p('me'), p('b'), p('c'), p('d')], 'me');
    expect(four.map((s) => s.railSide)).toEqual(['left', 'left', 'right', 'right']);

    const three = seating([p('me'), p('b'), p('c')], 'me');
    expect(three.map((s) => s.railSide)).toEqual(['left', 'left', 'right']);
  });

  // One column, so there is no outer flank to pick and both rails take the left.
  it('puts both rails on the left when the table is stacked', () => {
    const two = seating([p('me'), p('b')], 'me');
    expect(two.map((s) => s.railSide)).toEqual(['left', 'left']);
  });

  // The server shuffles the players list into turn order when the table is built and leaves each
  // player's lobby seat as it was, so the seat numbers say nothing about who plays next. Sorted by
  // them, the turn went from bottom-left to the diagonal.
  it('follows the order of the players list, not their lobby seats', () => {
    const shuffled = [
      { id: 'me', seat: 0 },
      { id: 'c', seat: 2 },
      { id: 'd', seat: 3 },
      { id: 'b', seat: 1 },
    ];

    expect(seating(shuffled, 'me').map((s) => s.playerId)).toEqual(['me', 'c', 'd', 'b']);
  });
});
