// The context menu stays on screen and stays reachable.
//
// menuPlacement.ts decides where the menu goes and is unit-tested on its own, but it is fed
// numbers the component measures out of the DOM, and the menu it positions has a max-height and
// an overflow of its own. Whether the last item can actually be got at is only answerable here.
//
// A card in hand is the case worth testing: the hand sits along the bottom edge of the window, so
// this is where the menu has to flip up and away rather than run off the screen.

import { expect, test, type Locator, type Page } from '@playwright/test';
import { needsCardIndex, openSeat, startPlay } from './seat.js';

/** The margin menuPlacement.ts keeps between the menu and the edge of the window. */
const MARGIN = 8;

/** Boxes come back in fractional pixels; a hair over an edge is rounding, not a bug. */
const SLACK = 1;

test.beforeEach(needsCardIndex);

async function openMenuOnLastHandCard(page: Page): Promise<Locator> {
  await page.locator('.hand .card-tile').last().click({ button: 'right' });
  const menu = page.locator('.context-menu');
  // The menu hides itself until it has measured itself and been placed, so this also waits for
  // the position under test to have been decided.
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * Asserts a locator is wholly on screen, by arithmetic rather than by toBeInViewport.
 * An intersection ratio of exactly 1 is not reliable against a box that ends on a fractional
 * pixel flush with its scroll container's edge, which is precisely the case here.
 */
async function expectOnScreen(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(-SLACK);
  expect(box.y).toBeGreaterThanOrEqual(-SLACK);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + SLACK);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + SLACK);
}

test('opens inside the window and keeps its last item reachable', async ({ browser }) => {
  // Four seats: shared with hand-fan.spec.ts, which needs the hand left alone. Nothing here
  // plays a card.
  const page = await openSeat(browser, 4, 'Alice');
  await startPlay(page);

  await test.step('a window with room for it', async () => {
    const menu = await openMenuOnLastHandCard(page);
    const box = (await menu.boundingBox())!;
    const viewport = page.viewportSize()!;

    expect(box.x).toBeGreaterThanOrEqual(MARGIN);
    expect(box.y).toBeGreaterThanOrEqual(MARGIN);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

    // Given the room, the whole menu is laid out at once — no scrolling to reach the bottom of it.
    expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(false);
    await expectOnScreen(page, menu.locator('button').last());

    // Dismiss the way the app offers: the backdrop is what closes a menu (ContextMenu.tsx).
    await page.locator('.context-menu-backdrop').click();
    await expect(menu).toHaveCount(0);
  });

  await test.step('a window too short for it', async () => {
    // Shorter than the menu itself, so neither below the cursor nor above it can work. placeMenu
    // clamps to the margin and the menu scrolls; what must stay true is that it does not hang off
    // the top, and that the bottom of it can still be got at.
    await page.setViewportSize({ width: 1280, height: 300 });
    const menu = await openMenuOnLastHandCard(page);
    const box = (await menu.boundingBox())!;

    expect(box.y).toBe(MARGIN);
    expect(box.x).toBeGreaterThanOrEqual(MARGIN);
    expect(box.x + box.width).toBeLessThanOrEqual(1280);

    // It really is the overflow case, and not a menu that happened to fit.
    expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    // The last item is the one that used to be unreachable. Scrolled to, it is on screen.
    const last = menu.locator('button').last();
    await last.scrollIntoViewIfNeeded();
    await expectOnScreen(page, last);
  });
});
