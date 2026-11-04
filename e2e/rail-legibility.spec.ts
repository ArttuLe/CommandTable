// Every opponent's name and life total read from across the table at the zoom it opens at.
//
// The rail lives inside the plane, so it shrinks with the plane: at "Fit" a 4-seat table is drawn
// at about a fifth of its size, and a life total that is 2.1rem on the plane came out 5–8px on
// screen. Only a browser can say what size text actually reaches the screen.

import { expect, test } from '@playwright/test';
import { needsCardIndex, openSeat, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

test('names and life totals stay readable at Fit', async ({ browser }) => {
  // Four seats, the read-only bucket (see seat.ts): only reads sizes.
  const alice = await openSeat(browser, 4, 'Alice');
  await startPlay(alice);
  await alice.keyboard.press('f');

  // About 14px for life, a little less for the name: at this window both reach the cap that keeps a
  // three-digit total inside the 210px rail (styles.css), which lands just under 14.
  for (const [selector, floor] of [['.board-life', 13], ['.player-name', 10]] as const) {
    const heights = await alice
      .locator(`.player-rail ${selector}`)
      .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize) * el.getBoundingClientRect().height / (el as HTMLElement).offsetHeight));
    expect(heights).toHaveLength(4);
    for (const px of heights) expect(px, selector).toBeGreaterThanOrEqual(floor);
  }
});
