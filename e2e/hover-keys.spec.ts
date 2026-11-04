// Keys that act on the card under the cursor, and the two table signals (shortcuts.ts, Table.tsx).
//
// shortcuts.test.ts owns which move a key makes. What it cannot reach is "under the cursor" — a
// real :hover — and that the result is the same on someone else's screen.
//
// Three seats: plays a card and moves it, like the rest of that bucket (see seat.ts).

import { expect, test } from '@playwright/test';
import { needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

test('T taps and G bins the permanent under the cursor, on both screens', async ({ browser }) => {
  const alice = await openSeat(browser, 3, 'Alice');
  const bob = await openSeat(browser, 3, 'Bob');
  await startPlay(alice, [bob]);

  const id = await playFromHand(alice);
  const onAlice = alice.locator(`.battlefield [data-object-id="${id}"]`);
  const onBob = bob.locator(`.battlefield [data-object-id="${id}"]`);

  await onAlice.hover();
  await alice.keyboard.press('t');
  await expect(onBob).toHaveClass(/tapped/);

  await onAlice.hover();
  await alice.keyboard.press('g');
  await expect(onBob).toHaveCount(0);
  await expect(onAlice).toHaveCount(0);
});

test('a signal reaches the rest of the table', async ({ browser }) => {
  const alice = await openSeat(browser, 3, 'Alice');
  const bob = await openSeat(browser, 3, 'Bob');
  await startPlay(alice, [bob]);

  await alice.keyboard.press('r');
  await expect(bob.locator('.toast', { hasText: 'Hold on — I have a response' })).toBeVisible();
});
