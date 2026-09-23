// §16.2's shortcuts, written down somewhere. They were previously discoverable only as `title`
// hints on three of the buttons they duplicate, which left the other half of them a secret.
//
// The `?` sits beside the gear in the status bar: both are about the table rather than about a
// card or a zone, and neither belongs in the HUD competing with the actions you take every turn.

import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog.js';
import { KEY_SHORTCUTS, MOUSE_SHORTCUTS, type Shortcut } from './shortcuts.js';

export function HelpButton() {
  const [open, setOpen] = useState(false);
  // Focus comes back to the button on close, so a keyboard user isn't dropped at the top of the
  // document — and the next keystroke reaches the table, not nothing.
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        className={`icon-button help-button ${open ? 'open' : ''}`}
        title="Quick actions and shortcuts"
        aria-label="Quick actions and shortcuts"
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && <HelpDialog onClose={() => setOpen(false)} buttonRef={ref} />}
    </>
  );
}

function HelpDialog({ onClose, buttonRef }: { onClose: () => void; buttonRef: React.RefObject<HTMLButtonElement> }) {
  useEffect(() => () => buttonRef.current?.focus(), [buttonRef]);

  return (
    <Dialog title="Quick actions" onCancel={onClose}>
      <div className="help-body">
        <ShortcutList title="Keyboard" shortcuts={KEY_SHORTCUTS} />
        <ShortcutList title="Mouse" shortcuts={MOUSE_SHORTCUTS} />
        <p className="popover-note">Keys are ignored while you are typing, or while a dialog is up.</p>
      </div>
      <div className="dialog-actions">
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the only control in a read-only dialog. */}
        <button autoFocus type="button" className="btn btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Dialog>
  );
}

function ShortcutList({ title, shortcuts }: { title: string; shortcuts: Shortcut[] }) {
  return (
    <section>
      <p className="popover-group">{title}</p>
      <dl className="shortcut-list">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.keys} className="shortcut-row">
            <dt>{shortcut.keys}</dt>
            <dd>{shortcut.what}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
