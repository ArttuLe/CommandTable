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
    // the top, and that the bottom of it can still be got at. A hand card's menu is short now that
    // it only offers what a card in hand can do (cardMenu.ts), so the window has to be very short
    // indeed — too short to show the hand at all, which is why the menu is opened from the
    // keyboard here: it asks for the menu at the tile however far off screen the tile has gone.
    await page.setViewportSize({ width: 1280, height: 120 });
    await page.locator('.hand .card-tile').last().focus();
    await page.keyboard.press('Shift+F10');
    const menu = page.locator('.context-menu');
    await expect(menu).toBeVisible();
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

// The help dialog promises Esc closes "whatever is open". Each of these popovers dismisses itself
// its own way, so each is checked on its own: a menu that only closes on a click is the bug.
test('Escape puts away whichever menu is open', async ({ browser }) => {
  // Four seats, read-only: opens things and closes them again.
  const page = await openSeat(browser, 4, 'Alice');
  await startPlay(page);

  const menus: { name: string; open: () => Promise<unknown>; popover: string }[] = [
    { name: 'card menu', open: () => openMenuOnLastHandCard(page), popover: '.context-menu' },
    {
      name: 'table menu',
      open: () => page.locator('.plane-viewport').click({ button: 'right', position: { x: 12, y: 12 } }),
      popover: '.context-menu',
    },
    { name: 'More', open: () => page.getByRole('button', { name: /^More/ }).click(), popover: '.more-popover' },
    { name: 'settings', open: () => page.getByRole('button', { name: 'Settings' }).click(), popover: '.settings-popover' },
    { name: 'library', open: () => page.locator('.zone-tile', { hasText: 'Library' }).click(), popover: '.zone-popover' },
  ];

  for (const { name, open, popover } of menus) {
    await test.step(name, async () => {
      await open();
      await expect(page.locator(popover)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator(popover)).toHaveCount(0);
    });
  }
});

// One Escape closes one thing. With a card's menu open over the library popover, both listened, and
// closing the library as well ran its shuffle-on-close behind the player's back.
test('Escape closes only the menu on top', async ({ browser }) => {
  // Three seats: searching changes what is visible in the library, which the read-only bucket must
  // not do (see seat.ts).
  const page = await openSeat(browser, 3, 'Carol');
  await page.getByRole('button', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Search library' }).click();
  await expect(page.locator('.zone-popover .card-tile').first()).toBeVisible();

  await page.locator('.zone-popover .card-tile').first().focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('.context-menu')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.context-menu')).toHaveCount(0);
  await expect(page.locator('.zone-popover')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.zone-popover')).toHaveCount(0);
});

// The keyboard's round trip through a card's menu (menuKeys.ts). Focus going into the menu, along
// it and back out to the card is the behaviour; a dialog raised from the menu used to close onto
// <body>, so the next Tab started over from the top of the page.
test('the keyboard goes into a card menu, along it, and back to the card', async ({ browser }) => {
  // Four seats, read-only: the dialog is cancelled, so no label is ever written.
  const page = await openSeat(browser, 4, 'Alice');
  await startPlay(page);
  const card = page.locator('.hand .card-tile').last();

  await card.focus();
  await page.keyboard.press('Shift+F10');
  const buttons = page.locator('.context-menu button:not([disabled])');
  await expect(buttons.first()).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(buttons.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(buttons.last()).toBeFocused();

  await page.getByRole('button', { name: 'Add label…' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card).toBeFocused();
});
