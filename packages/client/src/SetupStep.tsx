// The opening-hand step: the moment between the deal and turn 1.
//
// The deal used to drop straight into the game, so a mulligan was something you took
// *during* your first turn, after the table had already started moving. This is that moment made
// explicit — everyone decides on their hand, and the host starts the game when the table is ready.
//
// It gates nothing. The host's button is always live; it only warns when someone is still
// deciding, because a player who has walked away must not be able to hold up the table.

import type { PlayerId, PlayerState } from '@command-table/common';
import { setupStatus } from './setupStatus.js';
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
  const status = setupStatus({
    handCount,
    mulligans: me?.counters.mulligan ?? 0,
    kept: !!me?.keptHand,
    isHost,
    deciding: waiting.map((p) => p.displayName),
  });

  return (
    <div className="setup-step">
      <div className="setup-headline">
        <strong>Opening hands</strong>
        <span className="popover-note">{status.note}</span>
      </div>

      <div className="setup-actions">
        {me?.keptHand ? (
          <button className="btn" onClick={() => act({ t: 'MULLIGAN', playerId })}>
            Mulligan anyway
          </button>
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

      {/* Where the step stands: your own decision, then whoever everybody is waiting on, so
          nobody has to ask out loud. Both are prose and read as one sentence, which is why "You
          kept." sits here rather than in among the buttons — it is a statement about the table,
          not a control. */}
      <span className="setup-status">
        {status.kept && <span className="setup-kept">{status.kept}</span>}
        <span className="setup-waiting">{status.waiting}</span>
      </span>

      {/* Keep is the step's one primary until everyone has; only then is starting the thing to do. */}
      {isHost && (
        <button
          className={`btn ${waiting.length === 0 ? 'btn-primary' : ''}`}
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
