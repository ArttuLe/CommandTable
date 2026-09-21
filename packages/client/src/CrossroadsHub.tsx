import type { PlayerId, PlayerState, TurnTracker } from '@command-table/common';
import type { CommanderRef } from './commanders.js';
import { useCommanderName } from './commanders.js';
import type { Seat } from './seating.js';
import { turnHighlight, type TurnHighlight } from './turnStatus.js';
import {
  COMMANDER_DAMAGE_LETHAL,
  damageTakenFrom,
  isLethalCommanderDamage,
  isLethalLife,
  isLethalPoison,
} from './vitals.js';

interface CrossroadsHubProps {
  players: PlayerState[];
  seats: Seat[];
  turn: TurnTracker;
  myId: PlayerId;
  allCommanders: CommanderRef[];
}

/**
 * The readout at the crossroads, where the four mats meet. Life lives here rather than on each
 * board because it's the one number every player checks constantly and it belongs to the table,
 * not to any one mat — each player's readout sits in the corner nearest their own board.
 *
 * It only reports. Every number on it is written from its owner's own HUD (ActionBar's
 * VitalsPad), so no one can quietly edit a neighbour's total and the readout stays something you
 * read at a glance instead of a cluster of small buttons repeated once per seat.
 *
 * Poison and commander damage show only when there is any: a badge per commander that has
 * actually connected, rather than a row of zeroes every game starts with.
 */
export function CrossroadsHub({ players, seats, turn, myId, allCommanders }: CrossroadsHubProps) {
  const stacked = seats.length <= 2;

  return (
    <div className={`crossroads ${stacked ? 'stacked' : 'quad'}`}>
      {seats.map((seat) => {
        const player = players.find((p) => p.id === seat.playerId);
        if (!player) return null;
        return (
          <LifeReadout
            key={seat.playerId}
            player={player}
            gridArea={seat.gridArea}
            turn={turnHighlight(player.id, turn, myId)}
            allCommanders={allCommanders}
          />
        );
      })}
    </div>
  );
}

function LifeReadout({
  player,
  gridArea,
  turn,
  allCommanders,
}: {
  player: PlayerState;
  gridArea: string;
  turn: TurnHighlight;
  allCommanders: CommanderRef[];
}) {
  const poison = player.counters.poison ?? 0;
  const damage = damageTakenFrom(player, allCommanders);

  return (
    <div
      // Ringed here too: the active player stays identifiable when their mat is panned off-screen.
      className={`life-readout ${turn ? `turn-${turn}` : ''} ${player.status !== 'active' ? 'eliminated' : ''}`}
      style={{ gridArea }}
    >
      <span className="readout-name">
        {player.displayName}
        {!player.connected && ' (disconnected)'}
        {player.status !== 'active' && ` — ${player.status}`}
      </span>

      <span className={`readout-life ${isLethalLife(player.life) ? 'lethal' : ''}`}>
        <strong>{player.life}</strong>
      </span>

      {/* Only what is actually happening to this player: an unpoisoned, unhit board shows neither. */}
      <span className="readout-badges">
        {poison > 0 && <span className={`poison ${isLethalPoison(poison) ? 'lethal' : ''}`}>☠ {poison}</span>}
        {damage.map((entry) => (
          <DamageBadge key={entry.commander.id} commander={entry.commander} damage={entry.damage} />
        ))}
      </span>
    </div>
  );
}

/** Which commander dealt it is in the title rather than on the badge — the badge has to stay
    readable at the zoom where a whole four-player table fits on screen. */
function DamageBadge({ commander, damage }: { commander: CommanderRef; damage: number }) {
  const name = useCommanderName(commander);
  return (
    <span
      className={`cmdr-damage ${isLethalCommanderDamage(damage) ? 'lethal' : ''}`}
      title={`${damage} commander damage from ${name} — lethal at ${COMMANDER_DAMAGE_LETHAL}`}
    >
      ⚔ {damage}
    </span>
  );
}
