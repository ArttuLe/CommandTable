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

// Cards were divs with click handlers and nothing else, so playing, tapping and the card menu
// were mouse-only. A focused card answers Enter the way it answers its click, and the context
// menu key (Shift+F10) the way it answers a right-click.
test('a card can be played and opened from the keyboard', async ({ browser }) => {
  // Three seats: plays a card, like the rest of that bucket (see seat.ts).
  const page = await openSeat(browser, 3, 'Alice');
  await startPlay(page);

  const tile = page.locator('.hand .card-tile').last();
  const id = await tile.getAttribute('data-object-id');
  await tile.focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.keyboard.press('Escape');

  await tile.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`.battlefield [data-object-id="${id}"]`)).toBeVisible();
});
