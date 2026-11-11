// The opening-hand step (SetupStep.tsx): the moment between the deal and turn 1.
//
// Two seats, because most of what this step does is tell the table about itself — who is still
// deciding, and one person's button moving everybody to a board.

import { expect, test } from '@playwright/test';
import { handIds, needsCardIndex, openSeat, OPENING_HAND } from './seat.js';

test.beforeEach(needsCardIndex);

test('mulligan, keep, and the host starting the game', async ({ browser }) => {
  // Two seats is this spec's alone: it is the only one that needs a table nobody has started.
  const alice = await openSeat(browser, 2, 'Alice');
  const bob = await openSeat(browser, 2, 'Bob');

  await expect(alice.locator('.turn-pill')).toHaveText('Opening hands');
  await expect(alice.locator('.setup-waiting')).toHaveText(/Alice/);
  await expect(alice.locator('.setup-waiting')).toHaveText(/Bob/);

  // Nobody's turn has started, so nothing should be urging anyone to end it.
  await expect(alice.getByRole('button', { name: 'Pass turn' })).not.toHaveClass(/urgent/);
  await expect(alice.locator('.hud')).not.toHaveClass(/my-turn/);
  await expect(alice.locator('.turn-badge')).toHaveCount(0);

  // The hand is for judging, not playing, until the game starts: a double-click that would play a
  // card in a game does nothing here. The mulligan below is the round trip that proves it — had
  // the double-click sent a move, the server would have applied it first.
  await alice.locator('.hand .card-tile').last().dblclick();

  // A mulligan here is not a London one: it shuffles back and redraws seven (playerActions.ts).
  const before = await handIds(alice);
  await alice.getByRole('button', { name: 'Mulligan', exact: true }).click();
  await expect(alice.locator('.hand .card-tile')).toHaveCount(OPENING_HAND);
  await expect.poll(() => handIds(alice)).not.toEqual(before);
  await expect(alice.locator('.battlefield .card-tile')).toHaveCount(0);
  // Redrawing seven means the extra card goes to the bottom by hand, so the step says so.
  await expect(alice.locator('.setup-headline')).toContainText(
    'Mulligan 1: put 1 card on the bottom — right-click it and choose Bottom.'
  );

  // Keeping is reported to the other seat, not just this one.
  await alice.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(alice.locator('.setup-kept')).toHaveText('You kept.');

  // "You kept." is prose, and sits on the line with the step's other prose rather than in among
  // the buttons — same row, same baseline, whatever the two of them say.
  const kept = (await alice.locator('.setup-kept').boundingBox())!;
  const waiting = (await alice.locator('.setup-waiting').boundingBox())!;
  expect(kept.y + kept.height).toBeCloseTo(waiting.y + waiting.height, 0);

  await expect(bob.locator('.setup-waiting')).toHaveText(/Bob/);
  await expect(bob.locator('.setup-waiting')).not.toHaveText(/Alice/);

  // A non-host who has kept has nothing left to do, and is told who they are waiting on.
  await bob.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(bob.locator('.setup-kept')).toHaveText('You kept — waiting for the host to start the game.');
  await expect(alice.locator('.setup-waiting')).toHaveText('Everyone has kept.');

  // Only the host is offered the start, and one click moves both browsers.
  await expect(bob.getByRole('button', { name: 'Start the game' })).toHaveCount(0);
  await alice.getByRole('button', { name: 'Start the game' }).click();
  await expect(alice.locator('.setup-step')).toHaveCount(0);
  await expect(bob.locator('.setup-step')).toHaveCount(0);
  await expect(alice.locator('.turn-pill')).not.toHaveText('Opening hands');
});
