// The keyboard's side of the two right-click menus (a card's and the table's). Opening one moves
// focus into it, the arrows walk its buttons, and closing it hands focus back to whatever had it —
// the card tile, when the menu came from Shift+F10. Without that last part a dialog raised from the
// menu ("Add label…") closed onto <body>, and the next Tab started from the top of the page.

import { useEffect, useRef } from 'react';

/** Where focus goes for a key, among `count` buttons; null for a key the menu does not handle. */
export function nextMenuIndex(current: number, count: number, key: string): number | null {
  switch (key) {
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

function buttonsIn(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>('button:not([disabled])')];
}

/**
 * Wires a menu element to the keyboard. `placed` is the menu's own "measured and on screen" flag:
 * focus waits for it, since a menu still hidden for measuring cannot take focus.
 * Returns the menu's onKeyDown.
 */
export function useMenuKeys(ref: React.RefObject<HTMLElement | null>, placed: boolean) {
  // Read before the menu's first commit takes anything, so it is whatever opened the menu.
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(
    () => () => {
      if (opener.current?.isConnected) opener.current.focus();
    },
    []
  );

  const focused = useRef(false);
  useEffect(() => {
    if (!placed || focused.current || !ref.current) return;
    focused.current = true;
    buttonsIn(ref.current)[0]?.focus();
  }, [placed, ref]);

  return (e: React.KeyboardEvent) => {
    if (!ref.current) return;
    const buttons = buttonsIn(ref.current);
    const next = nextMenuIndex(buttons.indexOf(document.activeElement as HTMLElement), buttons.length, e.key);
    if (next === null || buttons.length === 0) return;
    e.preventDefault();
    buttons[next].focus();
  };
}
