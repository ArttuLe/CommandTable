import { useState } from 'react';
import type { DeckStatus, DeckWarningKind } from '@command-table/common';
import { ConfirmDialog } from './ConfirmDialog.js';
import { saveDecklist, storedDecklist } from './session.js';
import { useStore } from './store.js';

export function Lobby() {
  const roomState = useStore((s) => s.roomState)!;
  const playerId = useStore((s) => s.playerId);
  const deckResult = useStore((s) => s.deckResult);
  const send = useStore((s) => s.send);
  const leave = useStore((s) => s.leave);
  const showError = useStore((s) => s.showError);
  // Prefilled from the last deck submitted on this browser, so playing a second game after
  // "End game" doesn't mean re-pasting a hundred lines.
  const [deckText, setDeckText] = useState(storedDecklist);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);

  // navigator.clipboard is only available in a secure context, and the whole point of this app is
  // that it is served over plain http on a tailnet (playing-with-a-friend.md). The old
  // execCommand path still works there, so it is the fallback rather than an error message.
  async function copyRoomCode() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(roomState.roomId);
      ok = true;
    } catch {
      const scratch = document.createElement('textarea');
      scratch.value = roomState.roomId;
      scratch.style.position = 'fixed';
      scratch.style.opacity = '0';
      document.body.appendChild(scratch);
      scratch.select();
      ok = document.execCommand('copy');
      scratch.remove();
    }

    if (!ok) {
      // The code is on screen next to this button, so failing to copy costs nothing but the
      // convenience — say so rather than flashing a tick that didn't happen.
      showError('Could not copy — the room code is right there to type.');
      return;
    }
    // Stays ticked rather than reverting: it is a statement that the code is on your clipboard,
    // and that stays true. A tick that vanished would just make you wonder if it worked.
    setCopied(true);
  }

  const isHost = roomState.hostId === playerId;
  const mySeat = roomState.seats.find((s) => s.playerId === playerId);

  return (
    <div className="lobby">
      <header className="lobby-header">
        <h2>Room</h2>
        <span className="room-code">
          {roomState.roomId}
          <button
            className="icon-button copy-code"
            onClick={copyRoomCode}
            title="Copy room code"
            aria-label="Copy room code"
          >
            {copied ? '✓' : '⧉'}
          </button>
        </span>
        {isHost && (
          <button className="btn btn-lg btn-primary" onClick={() => send({ t: 'start' })}>
            Start the game
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => setConfirmLeave(true)}>
          Leave
        </button>
      </header>

      {confirmLeave && (
        <ConfirmDialog
          title="Leave the table?"
          message="Your seat is held. You can come back with the room code and passphrase."
          confirmLabel="Leave"
          onConfirm={() => {
            setConfirmLeave(false);
            leave();
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      <section className="panel">
        <p className="panel-title">Seats</p>
        <table className="seats">
          <thead>
            <tr>
              <th>Seat</th>
              <th>Player</th>
              <th />
              <th>Ready</th>
              <th>Deck</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {roomState.seats.map((seat) => (
              <tr key={seat.seat} className={seat.playerId === playerId ? 'me' : ''}>
                <td>{seat.seat + 1}</td>
                <td>{seat.displayName ?? <em>open</em>}</td>
                <td className={seat.connected ? 'dot-on' : 'dot-off'}>
                  {seat.playerId ? (seat.connected ? '●' : '○') : ''}
                </td>
                <td className={seat.ready ? 'ready-yes' : ''}>{seat.playerId ? (seat.ready ? '✓' : '—') : ''}</td>
                <td>
                  {seat.playerId && <span className={`deck-pill deck-${seat.deckStatus}`}>{deckStatusLabel(seat.deckStatus)}</span>}
                </td>
                <td>
                  {/* Someone who reconnects under the same name reclaims their seat on their own,
                      so this is only for a seat nobody is coming back to. */}
                  {isHost && seat.playerId && !seat.connected && (
                    <button
                      className="seat-free"
                      title={`Free seat ${seat.seat + 1}`}
                      aria-label={`Free seat ${seat.seat + 1}`}
                      onClick={() => send({ t: 'freeSeat', seat: seat.seat })}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {mySeat && (
        <section className="panel deck-form">
          <p className="panel-title">Your deck</p>
          <label>
            Paste your decklist
            <textarea
              rows={8}
              value={deckText}
              onChange={(e) => setDeckText(e.target.value)}
              placeholder={'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n100 Sol Ring\n...'}
            />
          </label>
          <button
            className="btn"
            onClick={() => {
              saveDecklist(deckText);
              send({ t: 'deck', list: deckText });
            }}
          >
            Submit deck
          </button>

          {deckResult && (
            <div className="deck-result">
              {deckResult.warnings.length === 0 && deckResult.unresolved.length === 0 && (
                <p className="deck-note ok">Deck resolved with no warnings.</p>
              )}
              {deckResult.unresolved.length > 0 && (
                <div className="deck-note unresolved">
                  <strong>Unresolved cards:</strong>
                  <ul>
                    {deckResult.unresolved.map((u, i) => (
                      <li key={i}>
                        {u.line.quantity}x {u.line.name}
                        {u.suggestions.length > 0 && <> — did you mean {u.suggestions.join(', ')}?</>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {deckResult.warnings.length > 0 && (
                <div className="deck-note warnings">
                  <strong>Warnings:</strong>
                  <ul>
                    {deckResult.warnings.map((w, i) => (
                      <li key={i}>{describeWarning(w)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <label className="ready-toggle">
            <input type="checkbox" checked={mySeat.ready} onChange={(e) => send({ t: 'ready', ready: e.target.checked })} />
            Ready
          </label>
        </section>
      )}
    </div>
  );
}

function deckStatusLabel(status: DeckStatus): string {
  switch (status) {
    case 'none':
      return 'No deck';
    case 'ok':
      // Not "Ready" — that is the column next door, and it means the player ticked the toggle.
      // This one only says the decklist resolved against the card index.
      return 'Resolved';
    case 'warnings':
      return 'Warnings';
  }
}

function describeWarning(w: DeckWarningKind): string {
  switch (w.kind) {
    case 'wrong_deck_size':
      return `Deck has ${w.actual} cards (expected ${w.expected}).`;
    case 'duplicate_nonbasic':
      return `${w.count}x ${w.name} — non-basic card appears more than once.`;
    case 'color_identity_violation':
      return `${w.name} (${w.cardIdentity.join('') || 'colorless'}) is outside your commander's color identity (${w.commanderIdentity.join('') || 'colorless'}).`;
  }
}
