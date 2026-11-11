// The keyboard shortcuts, written down somewhere. They were previously discoverable only as `title`
// hints on three of the buttons they duplicate, which left the other half of them a secret.
//
// The `?` sits beside the gear in the status bar: both are about the table rather than about a
// card or a zone, and neither belongs in the HUD competing with the actions you take every turn.

import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog.js';
import { useUiStore } from './uiStore.js';
import { HOW_TOS, KEY_SHORTCUTS, MOUSE_SHORTCUTS, type Shortcut } from './shortcuts.js';
import { HelpIcon } from './icons.js';

export function HelpButton() {
  // In the ui store, so the `?` key (Table.tsx) opens the same dialog.
  const open = useUiStore((s) => s.helpOpen);
  const toggleHelp = useUiStore((s) => s.toggleHelp);
  // Focus comes back to the button on close, so a keyboard user isn't dropped at the top of the
  // document — and the next keystroke reaches the table, not nothing.
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        className={`icon-button help-button ${open ? 'open' : ''}`}
        title="Help: how to play, and shortcuts"
        aria-label="Help"
        onClick={toggleHelp}
      >
        <HelpIcon />
      </button>
      {open && <HelpDialog onClose={toggleHelp} buttonRef={ref} />}
    </>
  );
}

function HelpDialog({ onClose, buttonRef }: { onClose: () => void; buttonRef: React.RefObject<HTMLButtonElement> }) {
  useEffect(() => () => buttonRef.current?.focus(), [buttonRef]);
  const [tab, setTab] = useState<'tasks' | 'shortcuts'>('tasks');

  return (
    <Dialog title="Help" onCancel={onClose}>
      {/* Tasks first: a first game starts from "how do I…", and the gestures are the answer to
          that rather than a list to learn up front. */}
      <div className="help-tabs" role="tablist">
        {(['tasks', 'shortcuts'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`help-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'tasks' ? 'How do I…' : 'Shortcuts'}
          </button>
        ))}
      </div>
      <div className="help-body" role="tabpanel">
        {tab === 'tasks' ? (
          <dl className="howto-list">
            {HOW_TOS.map(({ task, how }) => (
              <div key={task} className="howto-row">
                <dt>{task}</dt>
                <dd>{how}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <>
            <ShortcutList title="Keyboard" shortcuts={KEY_SHORTCUTS} />
            <ShortcutList title="Mouse" shortcuts={MOUSE_SHORTCUTS} />
            <p className="popover-note">Keys are ignored while you are typing, or while a dialog is up.</p>
          </>
        )}
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
            <dt>
              <kbd>{shortcut.keys}</kbd>
            </dt>
            <dd>{shortcut.what}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
