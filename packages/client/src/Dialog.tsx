// The shell every in-app dialog shares: a backdrop, a panel, and the two things a dialog owes
// the keyboard — Escape closes it, and while it is up the table's shortcuts stand down (a
// dialog registers itself in the ui store, which Table reads before handling a key).
//
// Enter is deliberately not handled here. A form submits on Enter by itself, and a dialog whose
// primary button holds focus activates on Enter by itself; handling it here would fight both.

import { useEffect } from 'react';
import { useUiStore } from './uiStore.js';

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

  useEffect(() => {
    pushDialog();
    return popDialog;
  }, [pushDialog, popDialog]);

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
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
