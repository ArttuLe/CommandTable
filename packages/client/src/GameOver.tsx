// The end of a game, said once to everyone (see winner.ts). Not a modal: the table stays there
// to be looked at — who had what out is half of talking a game over — so this sits over the top
// of it and steps aside when asked. The host gets the way back to the lobby for the next game.

import { useState } from 'react';
import type { ClientTableState, PlayerId } from '@command-table/common';
import { useStore } from './store.js';
import { winnerOf } from './winner.js';

export function GameOver({ table, playerId, isHost }: { table: ClientTableState; playerId: PlayerId; isHost: boolean }) {
  const endGame = useStore((s) => s.endGame);
  const [dismissed, setDismissed] = useState(false);
  const winner = winnerOf(table.players);
  if (!winner || dismissed) return null;

  return (
    <section className="game-over" role="status" aria-label="Game over">
      <h2 className="game-over-title">{winner.id === playerId ? 'You win' : `${winner.displayName} wins`}</h2>
      <p className="game-over-summary">
        Turn {table.turn.turnNumber}, at {winner.life} life.
      </p>
      <ul className="game-over-standings">
        {table.players.map((p) => (
          <li key={p.id}>
            <span>{p.displayName}</span>
            <span className="game-over-life">{p.status === 'active' ? `${p.life} life` : `conceded at ${p.life}`}</span>
          </li>
        ))}
      </ul>
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={() => setDismissed(true)}>
          Look at the table
        </button>
        {isHost && (
          <button className="btn btn-primary" onClick={endGame}>
            Back to the lobby
          </button>
        )}
      </div>
    </section>
  );
}
