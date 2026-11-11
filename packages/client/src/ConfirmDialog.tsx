// A yes/no question, in place of window.confirm — which is styled by the browser, sits outside
// the table's look, and on some platforms pulls focus out of the tab entirely.

import { useEffect, useRef } from 'react';
import { Dialog } from './Dialog.js';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Which button holds focus on open, and so answers Enter. 'cancel' for the confirms a stray
   * Enter must not carry out (conceding, ending someone else's turn): taking those is then a
   * deliberate Tab or click.
   */
  focus?: 'confirm' | 'cancel';
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, focus = 'confirm' }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focused on open, which is also what makes Enter answer the question.
  useEffect(() => {
    (focus === 'cancel' ? cancelRef : confirmRef).current?.focus();
  }, [focus]);

  return (
    <Dialog title={title} onCancel={onCancel}>
      <p className="dialog-message">{message}</p>
      <div className="dialog-actions">
        <button className="btn btn-ghost" ref={cancelRef} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" ref={confirmRef} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
