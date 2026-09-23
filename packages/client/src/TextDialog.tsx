// One line of text, asked in the app's own voice — a marker's name, a card's annotation — in
// place of window.prompt, which is styled by the browser, sits outside the table's own keyboard
// handling, and cannot be corrected once you have started typing in it.

import { useState } from 'react';
import { Dialog } from './Dialog.js';

interface TextDialogProps {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  /** Set where an empty answer means something (clearing an annotation) rather than nothing. */
  allowEmpty?: boolean;
  submitLabel: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function TextDialog({
  title,
  label,
  initialValue = '',
  placeholder,
  allowEmpty = false,
  submitLabel,
  onSubmit,
  onCancel,
}: TextDialogProps) {
  const [text, setText] = useState(initialValue);
  const value = text.trim();

  return (
    <Dialog title={title} onCancel={onCancel}>
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (value || allowEmpty) onSubmit(value);
        }}
      >
        <label className="field">
          <span>{label}</span>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a one-field dialog is the field. */}
          <input autoFocus type="text" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!value && !allowEmpty}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
