// The turn goes to the next mat clockwise (seating.ts).
//
// Two halves have to agree, and only a browser holds both: the server decides who plays next (it
// shuffles the players list into turn order when the table is built), and the client decides
// where each mat sits. They once disagreed — the mats were laid out by lobby seat, which the
// shuffle leaves alone — and the turn went from bottom-left to the diagonal.
//
// The deal is random, so a broken layout can still happen to match it: at four seats it does one
// time in six. Four seats rather than three, where it would be one time in two.
//
// It passes the turn all the way round, so the table ends on the player it started on — the
// four-seat bucket stays read-only for everyone else (see seat.ts).

import { expect, test, type Page } from '@playwright/test';
import { needsCardIndex, openSeat, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

const CLOCKWISE = ['bottom-left', 'top-left', 'top-right', 'bottom-right'];

/** Where the active player's mat sits, read off the layout rather than out of the state. */
function litArea(page: Page): Promise<string> {
  return page.locator('.mat.turn-mine, .mat.turn-theirs').evaluate((el) => (el as HTMLElement).style.gridRowStart);
}

async function passTurn(page: Page): Promise<void> {
  const mine = (await page.locator('.turn-pill.mine').count()) > 0;
  await page.locator('.action-bar').getByRole('button', { name: 'Pass turn' }).click();
  // Out of turn, passing asks first (turnStatus.ts); answering it is not what is under test.
  if (!mine) await page.getByRole('dialog').getByRole('button', { name: 'Pass turn' }).click();
}

test('the turn passes to the next mat clockwise', async ({ browser }) => {
  const alice = await openSeat(browser, 4, 'Alice');
  const others = await Promise.all(['Bob', 'Carol', 'Dave'].map((name) => openSeat(browser, 4, name)));
  await startPlay(alice, others);

  for (let pass = 0; pass < CLOCKWISE.length; pass++) {
    const from = await litArea(alice);
    await passTurn(alice);
    await expect.poll(() => litArea(alice)).toBe(CLOCKWISE[(CLOCKWISE.indexOf(from) + 1) % CLOCKWISE.length]);
  }
});
