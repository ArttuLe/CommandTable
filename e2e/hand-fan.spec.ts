// The hand never spills over the controls beside it.
//
// handFan.ts works out how far the cards have to overlap and is unit-tested on its own, but it is
// answering a question about room it was handed by the grid, and the answer is applied in CSS.
// Whether a card actually ends up on top of the action bar is a fact about the rendered page.

import { expect, test, type Page } from '@playwright/test';
import { needsCardIndex, openSeat, startPlay } from './seat.js';

/** The card size steps at these widths (styles.css), which is where the fan is squeezed hardest. */
const WIDTHS = [1280, 900, 760];

/** clientWidth is whole pixels measured against a fractional width — handFan.ts's SLACK. */
const SLACK = 1;

interface Box { x: number; y: number; width: number; height: number }

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return box;
}

test.beforeEach(needsCardIndex);

test('stays inside its own column at every card size', async ({ browser }) => {
  // Four seats, shared with context-menu.spec.ts: both leave the opening seven alone, and this
  // spec needs all seven, because seven is what crowds the row in the first place.
  const page = await openSeat(browser, 4, 'Alice');
  await startPlay(page);

  for (const width of WIDTHS) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 800 });
      // A hovered card lifts and grows (styles.css); measure the hand at rest.
      await page.mouse.move(0, 0);

      // Seven cards are a shade wider than the room the HUD gives them, so they always overlap.
      await expect(page.locator('.hand')).toHaveClass(/crowded/);

      const hand = await boxOf(page, '.hand');
      const actionBar = await boxOf(page, '.action-bar');
      const tiles = await page.locator('.hand .card-tile').all();
      expect(tiles).toHaveLength(7);

      for (const tile of tiles) {
        const box = (await tile.boundingBox())!;
        expect(overlaps(box, actionBar)).toBe(false);
        expect(box.x).toBeGreaterThanOrEqual(hand.x - SLACK);
        expect(box.x + box.width).toBeLessThanOrEqual(hand.x + hand.width + SLACK);
      }
    });
  }
});
