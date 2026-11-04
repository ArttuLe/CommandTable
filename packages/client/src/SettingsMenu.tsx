// Table settings, behind the gear in the status bar.
//
// A standing view preference — following the active player — kept out of the plane's own controls
// because it isn't a view command like Fit or zoom, how the table looks to you (prefs.ts), plus
// the two ways to stop playing. Both of those confirm first: one ends the game for everyone, and
// the other looks like quitting.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog.js';
import { useStore } from './store.js';
import { useUiStore } from './uiStore.js';
import { useCloseOnEscape } from './useCloseOnEscape.js';
import { ManaEmblem, SettingsIcon } from './icons.js';
import { CARD_BACKS, PLAYMATS, THEMES } from './prefs.js';

const THEME_NAMES = { C: 'Colourless', W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
const PLAYMAT_NAMES = { slate: 'Slate', felt: 'Green felt', wine: 'Wine', navy: 'Navy' };
const CARD_BACK_NAMES = { violet: 'Violet', crimson: 'Crimson', emerald: 'Emerald', onyx: 'Onyx' };

type Pending = 'leave' | 'endGame' | null;

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const ref = useRef<HTMLDivElement>(null);
  const followActivePlayer = useUiStore((s) => s.followActivePlayer);
  const toggleFollowActivePlayer = useUiStore((s) => s.toggleFollowActivePlayer);
  const prefs = useUiStore((s) => s.prefs);
  const setPrefs = useUiStore((s) => s.setPrefs);
  const leave = useStore((s) => s.leave);
  const endGame = useStore((s) => s.endGame);
  const isHost = useStore((s) => s.roomState?.hostId !== null && s.roomState?.hostId === s.playerId);
  useCloseOnEscape(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="settings-menu" ref={ref}>
      <button
        className={`icon-button gear ${open ? 'open' : ''}`}
        title="Settings"
        aria-label="Settings"
        onClick={() => setOpen((o) => !o)}
      >
        <SettingsIcon />
      </button>
      {open && (
        <div className="settings-popover">
          <p className="popover-group">View</p>
          <label>
            <input type="checkbox" checked={followActivePlayer} onChange={toggleFollowActivePlayer} />
            <span>
              Follow the active player
              <small>The table pans to whoever's turn it is and zooms in on their board.</small>
            </span>
          </label>

          <p className="popover-group">Look</p>
          <Swatches label="Theme" names={THEME_NAMES} options={THEMES} value={prefs.theme} onPick={(theme) => setPrefs({ theme })}>
            {(theme) => (
              <b className={`mana-symbol mana-${theme}`}>
                <ManaEmblem color={theme} />
              </b>
            )}
          </Swatches>
          <Swatches label="Playmat" names={PLAYMAT_NAMES} options={PLAYMATS} value={prefs.playmat} onPick={(playmat) => setPrefs({ playmat })}>
            {(playmat) => <span className="swatch-mat" data-playmat={playmat} />}
          </Swatches>
          <Swatches label="Card back" names={CARD_BACK_NAMES} options={CARD_BACKS} value={prefs.cardBack} onPick={(cardBack) => setPrefs({ cardBack })}>
            {(cardBack) => <span className="swatch-back" data-card-back={cardBack} />}
          </Swatches>

          <p className="popover-group">Table</p>
          <button className="popover-action" onClick={() => setPending('leave')}>
            Leave table
            <small>Your seat is held — you can come back with the room code.</small>
          </button>
          {isHost && (
            <button className="popover-action danger" onClick={() => setPending('endGame')}>
              End game
              <small>Sends everyone back to the lobby.</small>
            </button>
          )}
        </div>
      )}

      {pending === 'leave' && (
        <ConfirmDialog
          title="Leave the table?"
          message="Your seat is held and the game carries on without you. You can rejoin with the room code and passphrase."
          confirmLabel="Leave"
          onConfirm={() => {
            setPending(null);
            leave();
          }}
          onCancel={() => setPending(null)}
        />
      )}

      {pending === 'endGame' && (
        <ConfirmDialog
          title="End the game?"
          message="This ends the game for everyone and returns the table to the lobby. Seats and decklists are kept, so you can start another game right away."
          confirmLabel="End game"
          onConfirm={() => {
            setPending(null);
            endGame();
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/** One row of the Look group: a swatch per option, the picked one outlined, its name beside them. */
function Swatches<T extends string>(props: {
  label: string;
  names: Record<T, string>;
  options: readonly T[];
  value: T;
  onPick: (option: T) => void;
  children: (option: T) => ReactNode;
}) {
  const { label, names, options, value, onPick, children } = props;
  return (
    <div className="swatches" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          className={`swatch ${option === value ? 'picked' : ''}`}
          title={names[option]}
          aria-label={names[option]}
          aria-pressed={option === value}
          onClick={() => onPick(option)}
        >
          {children(option)}
        </button>
      ))}
      <small>
        {label}: {names[value]}
      </small>
    </div>
  );
}
