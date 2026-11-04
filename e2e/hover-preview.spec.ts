// The hover preview belongs to the card under the cursor, and a card that leaves the hand takes
// its preview with it.
//
// Only a browser can say so: the preview is cleared by mouseleave, and a tile that unmounts
// under the cursor never gets one — which is exactly what playing a card does to its tile.

import { expect, test } from '@playwright/test';
import { needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

test('goes away with the card that was played', async ({ browser }) => {
  // Three seats: plays a card, like the rest of that bucket (see seat.ts).
  const alice = await openSeat(browser, 3, 'Alice');
  await startPlay(alice);
  // Wide enough that the hand is not crowded (see handFan.ts). A crowded fan slides a neighbour
  // under the cursor when a card leaves, and hovering that one would hide the bug; an uncrowded
  // hand re-centres, which leaves the cursor in the gap past the new last card.
  await alice.setViewportSize({ width: 2400, height: 900 });
  await expect(alice.locator('.hand.crowded')).toHaveCount(0);

  await alice.locator('.hand .card-tile').last().hover();
  await expect(alice.locator('.zoom-preview')).toBeVisible();

  await playFromHand(alice);

  await expect(alice.locator('.zoom-preview')).toHaveCount(0);
});
