// The log names the card a line is about, on everyone's screen — the server only attaches a
// reference (LogEntry.subject), so it is each client that has to resolve it to the same name.

import { expect, test } from '@playwright/test';
import { needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

test('a card played from hand is named in the other player’s toast', async ({ browser }) => {
  // Three seats: plays a card, like the rest of that bucket (see seat.ts).
  const alice = await openSeat(browser, 3, 'Alice');
  const bob = await openSeat(browser, 3, 'Bob');
  await startPlay(alice, [bob]);

  const id = await playFromHand(alice);
  // The tile's title is the card's name, as Alice's own client resolved it.
  const name = await alice.locator(`.battlefield [data-object-id="${id}"]`).getAttribute('title');
  expect(name).toBeTruthy();

  await expect(bob.locator('.toast', { hasText: `moved ${name} to the battlefield` })).toBeVisible();
});
