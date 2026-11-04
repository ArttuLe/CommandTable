import { useEffect, useRef } from 'react';
import { useUiStore } from './uiStore.js';

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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || useUiStore.getState().openDialogs > 0) return;
      e.preventDefault();
      e.stopPropagation();
      latest.current();
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);
}
