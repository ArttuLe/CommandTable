import { useState } from 'react';
import type { DeckStatus, DeckWarningKind } from '@command-table/common';
import { ConfirmDialog } from './ConfirmDialog.js';
import { useStore } from './store.js';

export function Lobby() {
  const roomState = useStore((s) => s.roomState)!;
  const playerId = useStore((s) => s.playerId);
  const deckResult = useStore((s) => s.deckResult);
  const send = useStore((s) => s.send);
  const leave = useStore((s) => s.leave);
  const [deckText, setDeckText] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isHost = roomState.hostId === playerId;
  const mySeat = roomState.seats.find((s) => s.playerId === playerId);

  return (
    <div className="lobby">
      <header className="lobby-header">
        <h2>Room</h2>
        <span className="room-code">{roomState.roomId}</span>
        {isHost && (
          <button className="btn btn-lg btn-primary" onClick={() => send({ t: 'start' })}>
            Start game
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
              <th>Conn.</th>
              <th>Ready</th>
              <th>Deck</th>
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
          <button className="btn" onClick={() => send({ t: 'deck', list: deckText })}>
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
      return 'Ready';
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
