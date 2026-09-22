// A single number, asked in the app's own voice — the peek depth, in place of window.prompt.

import { useState } from 'react';
import { Dialog } from './Dialog.js';

interface NumberDialogProps {
  title: string;
  label: string;
  initialValue: number;
  /** Omitted where the answer may be negative, as the life adjustment is. */
  min?: number;
  submitLabel: string;
  onSubmit: (value: number) => void;
  onCancel: () => void;
}

export function NumberDialog({ title, label, initialValue, min, submitLabel, onSubmit, onCancel }: NumberDialogProps) {
  const [text, setText] = useState(String(initialValue));
  const value = Number(text);
  const valid = Number.isFinite(value) && Number.isInteger(value) && (min === undefined || value >= min);

  return (
    <Dialog title={title} onCancel={onCancel}>
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(value);
        }}
      >
        <label className="field">
          <span>{label}</span>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a one-field dialog is the field. */}
          <input autoFocus type="number" min={min} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
