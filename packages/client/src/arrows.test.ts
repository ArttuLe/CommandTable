import { describe, expect, it } from 'vitest';
import { arrowPaths, type Box } from './arrows.js';

// Two 100x140 cards, side by side with a 100px gap between their left edges.
const boxes: Record<string, Box> = {
  a: { x: 0, y: 0, width: 100, height: 140 },
  b: { x: 300, y: 0, width: 100, height: 140 },
};

describe('arrowPaths', () => {
  it('runs each arrow between the centres of the two cards', () => {
    const [arrow] = arrowPaths([{ kind: 'target', fromId: 'a', toId: 'b', mine: true }], boxes);
    expect(arrow.from).toEqual({ x: 50, y: 70 });
    expect(arrow.to).toEqual({ x: 350, y: 70 });
  });

  it('carries the kind through, since block and target arrows are drawn differently', () => {
    const [arrow] = arrowPaths([{ kind: 'block', fromId: 'a', toId: 'b', mine: true }], boxes);
    expect(arrow.kind).toBe('block');
  });

  it('carries whose arrow it is through, since that is what colours it', () => {
    const [arrow] = arrowPaths([{ kind: 'block', fromId: 'a', toId: 'b', mine: false }], boxes);
    expect(arrow.mine).toBe(false);
  });

  it('skips an arrow whose ends have not been measured yet', () => {
    // The first render happens before the card nodes exist to measure.
    expect(arrowPaths([{ kind: 'target', fromId: 'a', toId: 'missing', mine: true }], boxes)).toEqual([]);
    expect(arrowPaths([{ kind: 'target', fromId: 'missing', toId: 'b', mine: true }], boxes)).toEqual([]);
  });

  it('skips an arrow that would start and end in the same place', () => {
    // Nothing legible to draw, and the control-point maths degenerates.
    expect(arrowPaths([{ kind: 'target', fromId: 'a', toId: 'a', mine: true }], boxes)).toEqual([]);
  });

  it('bows the line to one side so two arrows between the same pair stay apart', () => {
    const [arrow] = arrowPaths([{ kind: 'block', fromId: 'a', toId: 'b', mine: true }], boxes);
    // Perpendicular to a horizontal run, so the control point is off the straight line.
    expect(arrow.control.y).not.toBe(70);
    expect(arrow.control.x).toBe(200);
  });

  it('gives each arrow a stable id, so React can key them', () => {
    const paths = arrowPaths(
      [
        { kind: 'block', fromId: 'a', toId: 'b', mine: true },
        { kind: 'target', fromId: 'a', toId: 'b', mine: true },
      ],
      boxes
    );
    expect(new Set(paths.map((p) => p.id)).size).toBe(2);
  });
});
