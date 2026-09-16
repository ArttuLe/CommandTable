import { useState } from 'react';
import type { DeckWarningKind } from '@command-table/common';
import { useStore } from './store.js';

export function Lobby() {
  const roomState = useStore((s) => s.roomState)!;
  const playerId = useStore((s) => s.playerId);
  const deckResult = useStore((s) => s.deckResult);
  const send = useStore((s) => s.send);
  const [deckText, setDeckText] = useState('');

  const isHost = roomState.hostId === playerId;
  const mySeat = roomState.seats.find((s) => s.playerId === playerId);

  return (
    <div className="lobby">
      <h2>
        Room <span className="room-code">{roomState.roomId}</span>
      </h2>

      <table className="seats">
        <thead>
          <tr>
            <th>Seat</th>
            <th>Player</th>
            <th>Connected</th>
            <th>Ready</th>
            <th>Deck</th>
          </tr>
        </thead>
        <tbody>
          {roomState.seats.map((seat) => (
            <tr key={seat.seat} className={seat.playerId === playerId ? 'me' : ''}>
              <td>{seat.seat + 1}</td>
              <td>{seat.displayName ?? <em>open</em>}</td>
              <td>{seat.playerId ? (seat.connected ? '●' : '○') : ''}</td>
              <td>{seat.playerId ? (seat.ready ? '✓' : '') : ''}</td>
              <td>{seat.deckStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {mySeat && (
        <>
          <label>
            Paste your decklist
            <textarea
              rows={8}
              value={deckText}
              onChange={(e) => setDeckText(e.target.value)}
              placeholder={'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n...'}
            />
          </label>
          <button onClick={() => send({ t: 'deck', list: deckText })}>Submit deck</button>

          {deckResult && (
            <div className="deck-result">
              {deckResult.warnings.length === 0 && deckResult.unresolved.length === 0 && <p>Deck resolved with no warnings.</p>}
              {deckResult.unresolved.length > 0 && (
                <div>
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
                <div>
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
        </>
      )}

      {isHost && <button onClick={() => send({ t: 'start' })}>Start game</button>}
    </div>
  );
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
