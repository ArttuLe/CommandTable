// Undo says what it would take back, the same way on every screen, and someone else's action asks
// before it becomes a vote. It used to be a bare button: a misclick followed by anyone else's
// action turned Alice's Undo into a vote on Bob's draw. Only the server's history knows which
// action that is, so it takes two clients to see they were both told the same thing.

import { expect, test } from '@playwright/test';
import { needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

test('Undo names what it takes back, and asks before a vote on someone else’s action', async ({ browser }) => {
  // Three seats: plays a card, like the rest of that bucket (see seat.ts). All three sit down, so
  // the majority is a known two of three.
  const alice = await openSeat(browser, 3, 'Alice');
  const bob = await openSeat(browser, 3, 'Bob');
  const carol = await openSeat(browser, 3, 'Carol');
  await startPlay(alice, [bob, carol]);
  const undo = (page: typeof alice) => page.locator('.action-bar').getByRole('button', { name: /^Undo/ });

  const id = await playFromHand(alice);
  const name = await alice.locator(`.battlefield [data-object-id="${id}"]`).getAttribute('title');
  await expect(undo(alice)).toHaveAccessibleName(`Undo: you moved ${name} to the battlefield`);

  // Bob acts before Alice notices her misclick: Undo now means his draw, on both screens.
  await bob.keyboard.press('d');
  await expect(undo(alice)).toHaveAccessibleName('Undo: Bob drew 1 card');
  await expect(undo(alice)).toContainText('Bob drew 1 card');
  await expect(undo(bob)).toHaveAccessibleName('Undo: you drew 1 card');

  // Not Alice's action, so she is asked before the table is.
  await alice.keyboard.press('z');
  const ask = alice.getByRole('dialog');
  await expect(ask).toContainText('Undo: Bob drew 1 card');
  await ask.getByRole('button', { name: 'Ask the table' }).click();

  await expect(bob.locator('.undo-request')).toContainText('Alice wants to undo: Bob drew 1 card');
  await bob.locator('.undo-request').getByRole('button', { name: 'Approve' }).click();
  // The revert says what it took back, rather than "reverted the game to an earlier point".
  await expect(carol.locator('.toast', { hasText: 'undid: Bob drew 1 card' })).toBeVisible();

  // Back on Alice's own play, which undoes at once, with nothing to confirm.
  await expect(undo(alice)).toHaveAccessibleName(`Undo: you moved ${name} to the battlefield`);
  await alice.keyboard.press('z');
  await expect(carol.locator('.toast', { hasText: `undid: Alice moved ${name} to the battlefield` })).toBeVisible();
  await expect(alice.locator(`.battlefield [data-object-id="${id}"]`)).toHaveCount(0);
  await expect(alice.getByRole('dialog')).toHaveCount(0);
});
