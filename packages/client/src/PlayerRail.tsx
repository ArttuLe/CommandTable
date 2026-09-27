import { isRedacted, type GameObject, type PlayerState, type ProjectedObject } from '@command-table/common';
import { CardTile } from './CardTile.js';
import { useCommanderName, type CommanderRef } from './commanders.js';
import { railCounts, type ZoneCounts } from './playerRail.js';
import type { TurnHighlight } from './turnStatus.js';
import {
  COMMANDER_DAMAGE_LETHAL,
  damageTakenFrom,
  isLethalCommanderDamage,
  isLethalLife,
  isLethalPoison,
} from './vitals.js';

export interface PlayerRailProps {
  player: PlayerState;
  turn: TurnHighlight;
  counts: ZoneCounts;
  commandZone: ProjectedObject[];
  /** Every commander on the table, for the damage badges — anyone's can have hit this player. */
  allCommanders: CommanderRef[];
  commanderCastCount: Record<string, number>;
  onCastCommander?: (obj: GameObject) => void;
  onObjectContextMenu: (obj: ProjectedObject) => (e: React.MouseEvent) => void;
}

/**
 * Everything about a player that isn't a card on their battlefield: who they are, what their
 * totals say, how big each of their zones is, and their command zone.
 *
 * It used to be a band across the board (`.board-header`), which put it at the *bottom* of every
 * near-side mat once the board's mirror had flipped it. That band cost every board a row of
 * height — the commander tile alone is most of one — on a plane where height is the scarce
 * dimension and the boards are already 1170px wide. Standing the same content up in a column
 * beside the board pays for it in the cheap dimension instead, and the plane simply grew by the
 * rail's width so the battlefield keeps every pixel it had.
 *
 * It takes the outer corner of its mat — outer column and outer row, the same rule the lands
 * follow (see seating.ts) — so a player's own readouts sit behind their own seat and the middle
 * where the mats meet stays contested space. Its contents read top-down on every mat, though:
 * the board's mirror is about which side cards advance from, and a list of numbers has no such
 * geometry to mirror.
 *
 * Read-only, and that is the point: every number here is written from its owner's own HUD
 * (ActionBar's VitalsPad, and their own plays), so nobody can quietly edit a neighbour's totals.
 * The one thing you can click is your own commander, to cast it.
 *
 * Whose turn it is stands *outside* the rail, on the empty half of the rail's column: it is the
 * one thing here that is not a fact about the player but about the moment, it comes and goes
 * every turn, and inside the rail it was a third thing competing with the name and the life for
 * the same line. Out on its own it is the only thing in that space, so it can be a full pill at
 * a size that reads from across a zoomed-out table.
 */
export function PlayerRail({
  player,
  turn,
  counts,
  commandZone,
  allCommanders,
  commanderCastCount,
  onCastCommander,
  onObjectContextMenu,
}: PlayerRailProps) {
  return (
    <div className="mat-side">
      {/* First in the DOM, and the `lands-*` mirror decides which side of the rail that puts it
          on — the same one-child-order trick the battlefield bands use. */}
      {turn && <span className="turn-badge">{turn === 'mine' ? 'Your turn' : 'Their turn'}</span>}

      <aside className="player-rail">
        <div className="rail-identity">
          <span className="player-name">{player.displayName}</span>
          {/* Disconnected, conceded, eliminated: said out loud next to the name, because the mat
              going half-opaque is not something you can read from across the table. */}
          {!player.connected && <span className="player-state">(disconnected)</span>}
          {player.status !== 'active' && <span className="player-state">— {player.status}</span>}
        </div>

        <RailVitals player={player} allCommanders={allCommanders} />

        {/* Graveyard and exile have never appeared on the plane at all — the zone dock in the HUD
            only ever holds your own — so how big anybody's graveyard is was a question you could
            not ask. The projection already sends both zones in full (they are public), so the
            counts cost nothing but the room the rail now has for them. */}
        <dl className="rail-counts">
          {railCounts(player, counts).map(({ key, label, value }) => (
            <div key={key} className={`rail-count rail-count-${key}`}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {commandZone.length > 0 && (
          <div className="command-zone">
            {commandZone.map((obj) => (
              <CommanderTile
                key={obj.id}
                obj={obj}
                taxCount={commanderCastCount[obj.id] ?? 0}
                onCast={onCastCommander && !isRedacted(obj) ? () => onCastCommander(obj) : undefined}
                onContextMenu={onObjectContextMenu(obj)}
              />
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function CommanderTile({
  obj,
  taxCount,
  onCast,
  onContextMenu,
}: {
  obj: ProjectedObject;
  taxCount: number;
  onCast?: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const tax = taxCount * 2;
  return (
    <div className="commander-tile">
      <CardTile obj={obj} onClick={onCast} onContextMenu={onContextMenu} />
      {/* The bare "+6" means nothing on its own — spell out what it is and what it costs you. */}
      {tax > 0 && (
        <span
          className="tax-badge"
          title={`Commander tax: cast ${taxCount} time${taxCount === 1 ? '' : 's'} from the command zone, so the next cast costs {${tax}} more. You pay it yourself — nothing here deducts mana.`}
        >
          +{tax} tax
        </span>
      )}
    </div>
  );
}

/**
 * What everyone at the table reads off this player: life, and whatever is actually happening to
 * them. Poison and commander damage show only when there is any — a badge per commander that has
 * actually connected, rather than the row of zeroes every game starts with.
 */
function RailVitals({ player, allCommanders }: { player: PlayerState; allCommanders: CommanderRef[] }) {
  const poison = player.counters.poison ?? 0;
  const damage = damageTakenFrom(player, allCommanders);

  return (
    <div className="board-vitals">
      {/* Sized to be legible across a zoomed-out plane rather than to be clicked. The ❤ is the
          one the vitals pad wears (ActionBar), so the number you read off a mat and the number
          you write in your own HUD are plainly the same number. */}
      <span className={`board-life ${isLethalLife(player.life) ? 'lethal' : ''}`}>
        <b className="vital-symbol">❤</b>
        {/* The number in its own element, the way the pad keeps its `vital-count`: the glyph
            labels the total and must not be part of reading it. */}
        <span className="life-count">{player.life}</span>
      </span>
      {poison > 0 && <span className={`poison ${isLethalPoison(poison) ? 'lethal' : ''}`}>☠ {poison}</span>}
      {damage.map((entry) => (
        <DamageBadge key={entry.commander.id} commander={entry.commander} damage={entry.damage} />
      ))}
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
