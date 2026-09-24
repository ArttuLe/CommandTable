// The opening-hand step: the moment between the deal and turn 1.
//
// §14.1 deals seven cards and drops straight into the game, so a mulligan was something you took
// *during* your first turn, after the table had already started moving. This is that moment made
// explicit — everyone decides on their hand, and the host starts the game when the table is ready.
//
// It gates nothing (§1.1). The host's button is always live; it only warns when someone is still
// deciding, because a player who has walked away must not be able to hold up the table.

import type { PlayerId, PlayerState } from '@command-table/common';
import { useStore } from './store.js';

export function SetupStep({
  players,
  playerId,
  isHost,
  handCount,
}: {
  players: PlayerState[];
  playerId: PlayerId;
  isHost: boolean;
  handCount: number;
}) {
  const act = useStore((s) => s.act);
  const me = players.find((p) => p.id === playerId);
  const waiting = players.filter((p) => !p.keptHand);

  return (
    <div className="setup-step">
      <div className="setup-headline">
        <strong>Opening hands</strong>
        <span className="popover-note">
          Mulligan until you like your {handCount === 1 ? 'card' : `${handCount} cards`}, then keep.
        </span>
      </div>

      <div className="setup-actions">
        {me?.keptHand ? (
          <>
            <span className="setup-kept">You kept.</span>
            <button className="btn" onClick={() => act({ t: 'MULLIGAN', playerId })}>
              Mulligan anyway
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => act({ t: 'MULLIGAN', playerId })}>
              Mulligan
            </button>
            <button className="btn btn-primary" onClick={() => act({ t: 'KEEP_HAND', playerId })}>
              Keep
            </button>
          </>
        )}
      </div>

      {/* Who everyone is waiting on, so nobody has to ask out loud. */}
      <span className="setup-waiting">
        {waiting.length === 0
          ? 'Everyone has kept.'
          : `Still deciding: ${waiting.map((p) => p.displayName).join(', ')}`}
      </span>

      {isHost && (
        <button
          className={`btn btn-primary ${waiting.length === 0 ? 'urgent' : ''}`}
          onClick={() => act({ t: 'BEGIN_PLAY' })}
          title={
            waiting.length === 0
              ? 'Start turn 1'
              : `${waiting.length} player${waiting.length === 1 ? ' is' : 's are'} still deciding — you can start anyway`
          }
        >
          Start the game
        </button>
      )}
    </div>
  );
}
