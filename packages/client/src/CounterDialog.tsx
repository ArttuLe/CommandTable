// A counter's type and how many, as one form rather than two window.prompts in a row — where
// cancelling the second threw away the first, and neither showed you what you had already typed.
//
// The one-click +1/+1 and -1/-1 items in the context menu still cover the counters that come up
// every turn; this is for everything else (loyalty, stun, charge) and for adding several at once.

import { useState } from 'react';
import { Dialog } from './Dialog.js';

const COMMON_KEYS = ['+1/+1', '-1/-1', 'loyalty', 'stun', 'charge'];

export function CounterDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (key: string, amount: number) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState('');
  const [amountText, setAmountText] = useState('1');
  const amount = Number(amountText);
  const valid = key.trim().length > 0 && Number.isInteger(amount) && amount !== 0;

  return (
    <Dialog title="Add counter" onCancel={onCancel}>
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(key.trim(), amount);
        }}
      >
        <div className="field-row">
          <label className="field">
            <span>Counter</span>
            {/* A datalist rather than a select: the catalog takes any key (§8.2), so the common
                ones are suggestions, not the whole list. */}
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the first field of a form you opened. */}
            <input autoFocus list="counter-keys" value={key} placeholder="+1/+1" onChange={(e) => setKey(e.target.value)} />
            <datalist id="counter-keys">
              {COMMON_KEYS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Amount</span>
            <input type="number" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </label>
        </div>
        <p className="popover-note">A negative amount removes counters.</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Apply
          </button>
        </div>
      </form>
    </Dialog>
  );
}
