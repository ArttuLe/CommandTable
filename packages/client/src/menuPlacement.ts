// Where a context menu actually gets drawn.
//
// The menu is `position: fixed` at the cursor, so a right-click near the bottom of the window
// used to run the menu off-screen with its last items unreachable. Placement is a pure function
// of cursor, menu size and viewport so it can be tested without a DOM; ContextMenu measures
// itself and feeds it.

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

const MARGIN = 8;

/**
 * Below-right of the cursor when it fits; flipped to the opposite side when it doesn't, so the
 * menu always grows away from the edge that's in the way. A menu taller than the viewport can't
 * satisfy either side, so it clamps to the margin and scrolls instead of hanging off the top.
 */
export function placeMenu(cursor: Point, menu: Size, viewport: Size): { left: number; top: number } {
  return {
    left: place(cursor.x, menu.width, viewport.width),
    top: place(cursor.y, menu.height, viewport.height),
  };
}

function place(at: number, extent: number, available: number): number {
  const flipped = at - extent;
  if (at + extent <= available - MARGIN) return at;
  // Kept clear of the far edge too: asked for beyond the window (the keyboard asks at a card's
  // centre, wherever that card has scrolled to), the flip alone left the menu off-screen.
  if (flipped >= MARGIN) return Math.max(MARGIN, Math.min(flipped, available - MARGIN - extent));
  return Math.max(MARGIN, available - MARGIN - extent);
}
