import { useEffect, useRef } from 'react';
import { useUiStore } from './uiStore.js';

/**
 * The open popovers, most recent last. Escape closes only the top one: with a card's menu open
 * over the library popover, closing both at once also ran the library's shuffle-on-close.
 */
const openPopovers: { current: () => void }[] = [];

function onKeyDown(e: KeyboardEvent) {
  const top = openPopovers.at(-1);
  if (e.key !== 'Escape' || !top || useUiStore.getState().openDialogs > 0) return;
  e.preventDefault();
  e.stopPropagation();
  top.current();
}

/**
 * Escape puts away an open popover — the help dialog promises it closes "whatever is open".
 *
 * Capture phase, like Dialog's, so the keystroke that closed the menu doesn't go on to reach the
 * table's shortcuts and clear the selection behind it. A dialog raised from the popover answers
 * Escape itself, so while one is up this stands aside rather than closing both at once.
 */
export function useCloseOnEscape(open: boolean, close: () => void) {
  // The latest close, so a caller can pass a fresh closure every render without re-arming.
  const latest = useRef(close);
  latest.current = close;

  useEffect(() => {
    if (!open) return;
    if (openPopovers.length === 0) window.addEventListener('keydown', onKeyDown, true);
    openPopovers.push(latest);
    return () => {
      openPopovers.splice(openPopovers.indexOf(latest), 1);
      if (openPopovers.length === 0) window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);
}
