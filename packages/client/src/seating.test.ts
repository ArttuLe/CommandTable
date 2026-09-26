import { describe, expect, it } from 'vitest';
import { seating } from './seating.js';

// Input is deliberately narrower than PlayerState — seating only cares about identity and turn
// order — so these fixtures stay readable. Structural typing lets real PlayerState[] through.
const at = (id: string, seat: number) => ({ id, seat });

describe('seating', () => {
  it('puts the local player bottom-left and the rest clockwise in turn order', () => {
    const result = seating([at('me', 0), at('b', 1), at('c', 2), at('d', 3)], 'me');

    expect(result.map((s) => [s.playerId, s.gridArea])).toEqual([
      ['me', 'bottom-left'],
      ['b', 'top-left'],
      ['c', 'top-right'],
      ['d', 'bottom-right'],
    ]);
  });

  it('wraps turn order around when the local player is not seat 0', () => {
    const result = seating([at('a', 0), at('b', 1), at('me', 2), at('d', 3)], 'me');

    expect(result.map((s) => [s.playerId, s.gridArea])).toEqual([
      ['me', 'bottom-left'],
      ['d', 'top-left'],
      ['a', 'top-right'],
      ['b', 'bottom-right'],
    ]);
  });

  it('leaves the bottom-right quadrant empty in a three-player game', () => {
    const result = seating([at('me', 0), at('b', 1), at('c', 2)], 'me');

    expect(result.map((s) => s.gridArea)).toEqual(['bottom-left', 'top-left', 'top-right']);
  });

  it('stacks a two-player game vertically instead of using a quadrant', () => {
    const result = seating([at('me', 0), at('b', 1)], 'me');

    expect(result.map((s) => [s.playerId, s.gridArea])).toEqual([
      ['me', 'bottom'],
      ['b', 'top'],
    ]);
  });

  it('orients every board so its lands hug the outer edge', () => {
    const four = seating([at('me', 0), at('b', 1), at('c', 2), at('d', 3)], 'me');
    expect(four.map((s) => s.landsSide)).toEqual(['bottom', 'top', 'top', 'bottom']);

    const two = seating([at('me', 0), at('b', 1)], 'me');
    expect(two.map((s) => s.landsSide)).toEqual(['bottom', 'top']);
  });

  // The rail carries what the board header used to, so it follows the same outer-edge rule the
  // lands do — outer column as well as outer row, which is what keeps it off the contested middle.
  it('puts every player rail on the outer flank of its column', () => {
    const four = seating([at('me', 0), at('b', 1), at('c', 2), at('d', 3)], 'me');
    expect(four.map((s) => s.railSide)).toEqual(['left', 'left', 'right', 'right']);

    const three = seating([at('me', 0), at('b', 1), at('c', 2)], 'me');
    expect(three.map((s) => s.railSide)).toEqual(['left', 'left', 'right']);
  });

  // One column, so there is no outer flank to pick and both rails take the left.
  it('puts both rails on the left when the table is stacked', () => {
    const two = seating([at('me', 0), at('b', 1)], 'me');
    expect(two.map((s) => s.railSide)).toEqual(['left', 'left']);
  });

  it('ignores seat numbering gaps, ordering by seat rather than by index', () => {
    const result = seating([at('c', 7), at('me', 2), at('b', 5)], 'me');

    expect(result.map((s) => s.playerId)).toEqual(['me', 'b', 'c']);
  });
});
