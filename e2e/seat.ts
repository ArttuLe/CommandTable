// The one shared piece of these tests: getting a browser into a seat at a dev table, and the two
// things almost every spec does once it is there.
//
// Isolation is by seat count. The server keeps one dev table per player amount and hands every
// browser asking for that amount the same one (devTableFor in server.ts), so two specs that want
// incompatible things must not name the same number. The suite runs with workers: 1 against a
// server process it started itself, so each count begins the run untouched.
//
//   2  opening-hand.spec.ts   exclusively — it is the only spec that needs setupComplete false
//   3  targeting, change-pulse, board-vitals,  they start play and play a card,
//      player-rail, hover-preview, hand-play,  move a number or bin a permanent; none of them
//      undo-vote, target-size, context-menu's  minds what the others left behind (undo-vote
//      stacked-Escape test (searches), log-names,
//      undo-names                              and undo-names must resolve their votes before
//                                              they end, or the next spec's first action
//                                              cancels it under them)
//   4  context-menu, hand-fan, plane-menu,  read-only after starting play (plane-menu only moves
//      rail-legibility, one-seat-one-tab,   its own camera; turn-order passes the turn round
//      turn-order, help-dialog              to where it started), and hand-fan needs all seven
//
// Two rules keep that true, and both break quietly if ignored: nothing else may use 2 seats, and
// nothing that plays a card may join the 4-seat bucket (hand-fan asserts the hand is crowded,
// which handFan.ts explains is true at seven and need not be at six).

import { existsSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

const CARD_DB = new URL('../packages/server/data/cards.sqlite3', import.meta.url);

/** The server cannot even boot without the ingested index, and it is gitignored. */
export function needsCardIndex(): void {
  test.skip(!existsSync(CARD_DB), 'run `npm run ingest --workspace @command-table/server` first');
}

/** The opening hand every seat is dealt. */
export const OPENING_HAND = 7;

/**
 * Opens `/devtest/:players/:name` and returns once the table has rendered — which, because the
 * hand only exists once a projection has arrived, also means the WebSocket is live.
 */
export async function openSeat(browser: Browser, players: number, name: string): Promise<Page> {
  const context = await browser.newContext();
  // Every tile fetches its art from Scryfall. Tiles are a fixed size in CSS, so dropping the
  // requests moves nothing and takes the network out of the run.
  await context.route('https://cards.scryfall.io/**', (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`/devtest/${players}/${name}`);
  // Any hand tile means a projection arrived, so the socket is live. Not a count: these tables
  // are shared per seat count, so an earlier spec in the same bucket may already have played one.
  await expect(page.locator('.hand .card-tile').first()).toBeVisible();
  return page;
}

/**
 * Keeps for every seat that is open and has the host start the game.
 *
 * Idempotent, because the seat-count buckets above are shared: the second spec to reach a table
 * finds play already underway and should walk straight past. `host` must be Alice — the room's
 * host is its first joiner (roomManager.ts), and only the host is offered the button.
 */
export async function startPlay(host: Page, others: Page[] = []): Promise<void> {
  if ((await host.locator('.setup-step').count()) === 0) return;

  for (const page of [host, ...others]) {
    await page.getByRole('button', { name: 'Keep', exact: true }).click();
    await expect(page.locator('.setup-kept')).toBeVisible();
  }
  await host.getByRole('button', { name: 'Start the game' }).click();
  for (const page of [host, ...others]) {
    await expect(page.locator('.setup-step')).toHaveCount(0);
  }
}

/** The object ids in this page's hand, left to right. */
export async function handIds(page: Page): Promise<(string | undefined)[]> {
  return page.locator('.hand .card-tile').evaluateAll((tiles) => tiles.map((t) => (t as HTMLElement).dataset.objectId));
}

/**
 * Plays a card out of hand onto the battlefield and returns its object id.
 *
 * A double-click: a single click on a hand card only looks at it. The last card
 * by default: a crowded hand overlaps its cards (styles.css), so the ones to its left are partly
 * covered and a click on them can be reported as intercepted. The id is read
 * before the click because it survives the move, which is what lets a caller name the tile
 * afterwards.
 */
export async function playFromHand(page: Page): Promise<string> {
  // The 3-seat bucket is shared by every spec that plays a card, and seven cards don't go round all
  // of them. Draw first when the hand is nearly out: one card to play, and one left over for a spec
  // that goes on to click a card in hand (targeting.spec.ts does).
  const hand = page.locator('.hand .card-tile');
  const held = await hand.count();
  for (let drawn = held; drawn < 2; drawn++) await page.keyboard.press('d');
  await expect.poll(() => hand.count()).toBeGreaterThanOrEqual(2);

  const tile = page.locator('.hand .card-tile').last();
  const id = await tile.getAttribute('data-object-id');
  if (!id) throw new Error('hand tile has no data-object-id');
  await tile.dblclick();
  await expect(page.locator(`.battlefield [data-object-id="${id}"]`)).toBeVisible();
  return id;
}
