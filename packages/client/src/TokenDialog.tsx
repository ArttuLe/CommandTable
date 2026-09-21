// Create token, as one form instead of five prompts in a row.
//
// The old flow asked for name, type line, power, toughness and quantity as five separate
// window.prompts: you couldn't see what you'd already typed, couldn't go back, and cancelling
// the fourth threw away the first three. Here it is one screen, with the type line following
// the name until you say otherwise — which is the only field most tokens ever need.

import { useState } from 'react';
import { Dialog } from './Dialog.js';
import { EMPTY_TOKEN_FORM, defaultTypeLine, tokenFromForm, type TokenDraft } from './tokenForm.js';

export function TokenDialog({ onCreate, onCancel }: { onCreate: (draft: TokenDraft) => void; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY_TOKEN_FORM);
  const [typeLineEdited, setTypeLineEdited] = useState(false);
  const draft = tokenFromForm(form);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <Dialog title="Create token" onCancel={onCancel}>
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft) onCreate(draft);
        }}
      >
        <label className="field">
          <span>Name</span>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the first field of a form you opened. */}
          <input
            autoFocus
            value={form.name}
            placeholder="Squirrel"
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                name: e.target.value,
                typeLine: typeLineEdited ? f.typeLine : defaultTypeLine(e.target.value),
              }))
            }
          />
        </label>

        <label className="field">
          <span>Type line</span>
          <input
            value={form.typeLine}
            placeholder={defaultTypeLine(form.name) || 'Token Creature — Squirrel'}
            onChange={(e) => {
              setTypeLineEdited(true);
              setForm((f) => ({ ...f, typeLine: e.target.value }));
            }}
          />
        </label>

        {/* The three numbers share a row: they're short, and they're what you tab through last. */}
        <div className="field-row">
          <label className="field">
            <span>Power</span>
            <input value={form.power} placeholder="—" onChange={set('power')} />
          </label>
          <label className="field">
            <span>Toughness</span>
            <input value={form.toughness} placeholder="—" onChange={set('toughness')} />
          </label>
          <label className="field">
            <span>Quantity</span>
            <input type="number" min={1} value={form.quantity} onChange={set('quantity')} />
          </label>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!draft}>
            Create
          </button>
        </div>
      </form>
    </Dialog>
  );
}
