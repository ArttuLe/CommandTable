// The pulse marks the card that changed, on everyone's screen.
//
// Each client works out what moved by diffing the projection it was sent against the one before
// (tableChanges.ts), so this is only really testable with two of them: the interesting claim is
// that the card Alice played lights up on *Bob's* table, and that nothing else does.

import { expect, test } from '@playwright/test';
import { needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

test('lands on the card that moved, and on no other', async ({ browser }) => {
  // Three seats: shared with targeting.spec.ts. Both play a card; neither minds the other's.
  const alice = await openSeat(browser, 3, 'Alice');
  // Bob has to be sitting here before Alice acts. The pulse is a diff of two projections Bob
  // received — if he arrives afterwards the card is simply already there, and nothing ever
  // pulses for him.
  const bob = await openSeat(browser, 3, 'Bob');
  await startPlay(alice, [bob]);

  // Nothing is lit to begin with: the first projection differs from nothing in every object, and
  // a change that large is a sweep rather than a moment, so tableChanges.ts shows none of it.
  await expect(bob.locator('.change-pulse')).toHaveCount(0);

  const playedId = await playFromHand(alice);

  await expect(bob.locator(`[data-object-id="${playedId}"] .change-pulse`)).toBeVisible();
  await expect(bob.locator('.change-pulse')).toHaveCount(1);
});
