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
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focused on open, which is also what makes Enter answer the question.
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <Dialog title={title} onCancel={onCancel}>
      <p className="dialog-message">{message}</p>
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" ref={confirmRef} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
