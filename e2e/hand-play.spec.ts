// A card in hand is read with a click and played with a double-click (§16.2).
//
// Playing reveals the card to everyone, and nothing takes that back — undo can only say that it
// leaked. A single click is also how people look at a card, so it must not be the gesture that
// plays one.

import { expect, test } from '@playwright/test';
import { handIds, needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

test('a single click on a card in hand does not play it', async ({ browser }) => {
  // Three seats: plays a card, like the rest of that bucket (see seat.ts).
  const page = await openSeat(browser, 3, 'Alice');
  await startPlay(page);

  const clickedId = (await handIds(page))[0];
  await page.locator(`.hand [data-object-id="${clickedId}"]`).click();

  // The double-click is the round trip that settles it: the server applies moves in order, so by
  // the time this card lands, a move from the single click would have landed first.
  await playFromHand(page);
  await expect(page.locator(`.hand [data-object-id="${clickedId}"]`)).toBeVisible();
  await expect(page.locator(`.battlefield [data-object-id="${clickedId}"]`)).toHaveCount(0);
});
