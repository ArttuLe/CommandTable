// The shell every in-app dialog shares: a backdrop, a panel, and the two things a dialog owes
// the keyboard — Escape closes it, and while it is up the table's shortcuts stand down (a
// dialog registers itself in the ui store, which Table reads before handling a key). It also
// keeps focus inside itself: Tab and Shift+Tab wrap at either end rather than walking off onto the
// table behind the backdrop.
//
// Enter is deliberately not handled here. A form submits on Enter by itself, and whichever button
// holds focus activates on Enter by itself (ConfirmDialog picks which); handling it here would
// fight both.

import { useEffect, useRef } from 'react';
import { useUiStore } from './uiStore.js';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  children,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  const pushDialog = useUiStore((s) => s.pushDialog);
  const popDialog = useUiStore((s) => s.popDialog);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pushDialog();
    return popDialog;
  }, [pushDialog, popDialog]);

  // Most dialogs focus their own field or button as they mount (children's effects run first);
  // only when none did does focus need fetching in from the table.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab' || !ref.current) return;
    // Recomputed on every Tab, so controls that appear or disable themselves stay in the cycle.
    const focusable = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last || document.activeElement !== (e.shiftKey ? first : last)) return;
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }

  // Capture phase, so the keystroke that dismissed this never reaches the table behind it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" onMouseDown={onCancel}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} onKeyDown={trapTab}>
        <h2 className="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
