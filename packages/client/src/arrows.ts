// Turning combat relations into lines to draw. Kept apart from the component, like planeView.ts,
// so the geometry is testable without a DOM — the component's whole job is measuring the cards
// and handing the boxes to this.
//
// Everything here is in plane coordinates: the overlay lives inside `.plane` and inherits its
// transform, so an arrow drawn at a card's plane position stays on that card through every pan
// and zoom without recomputing anything.

import type { ObjectId } from '@command-table/common';
import type { Relation } from './combat.js';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ArrowPath {
  id: string;
  kind: Relation['kind'];
  from: Point;
  to: Point;
  /** Quadratic control point — the bow in the line. */
  control: Point;
  /** Whose end the arrow starts at, so it can be drawn in that player's board colour. */
  mine: boolean;
}

// How far the line bows out, as a fraction of its own length. Enough to separate two arrows
// running between the same pair of cards; not so much that it wanders over a third card.
const BOW = 0.18;

function centerOf(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function arrowPaths(relations: Relation[], boxes: Record<ObjectId, Box>): ArrowPath[] {
  const paths: ArrowPath[] = [];

  for (const relation of relations) {
    const fromBox = boxes[relation.fromId];
    const toBox = boxes[relation.toId];
    // A card that hasn't been measured yet — the first paint, or one in a collapsed zone — has
    // no box, and there is nothing to draw between.
    if (!fromBox || !toBox) continue;

    const from = centerOf(fromBox);
    const to = centerOf(toBox);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;

    // Bow perpendicular to the run, so the curve is symmetric whichever way the arrow points.
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const control = {
      x: mid.x + (-dy / length) * length * BOW,
      y: mid.y + (dx / length) * length * BOW,
    };

    paths.push({
      id: `${relation.kind}:${relation.fromId}:${relation.toId}`,
      kind: relation.kind,
      mine: relation.mine,
      from,
      to,
      control,
    });
  }

  return paths;
}
