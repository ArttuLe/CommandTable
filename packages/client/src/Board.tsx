import type { GameObject, PlayerState, ProjectedObject } from '@command-table/common';
import { CardTile } from './CardTile.js';
import { useCards } from './useCard.js';
import { useUiStore } from './uiStore.js';
import { useStore } from './store.js';
import { ZONES, groupByZone, typeLineOf } from './battlefieldZones.js';
import { producedMana } from './manaSources.js';
import type { ManaColor } from './uiStore.js';
import { stackLands, stackNameOf } from './landStacks.js';
import type { Seat } from './seating.js';
import type { TurnHighlight } from './turnStatus.js';
import type { CommanderRef } from './commanders.js';
import { PlayerRail } from './PlayerRail.js';
import type { ZoneCounts } from './railCounts.js';

export interface BoardProps {
  player: PlayerState;
  seat: Seat;
  turn: TurnHighlight;
  counts: ZoneCounts;
  battlefield: ProjectedObject[];
  commandZone: ProjectedObject[];
  /** Every commander on the table, for the rail's damage badges — anyone's can have hit this player. */
  allCommanders: CommanderRef[];
  commanderCastCount: Record<string, number>;
  /** The second argument is what tapping would put in the mana pad (see manaSources.ts). */
  onTapToggle: (obj: { id: string; tapped: boolean }, produces: ManaColor[], e: React.MouseEvent) => void;
  onCastCommander?: (obj: GameObject) => void;
  onObjectContextMenu: (obj: ProjectedObject) => (e: React.MouseEvent) => void;
}

/**
 * One player's mat on the plane: their rail (PlayerRail.tsx) and their battlefield, oriented to
 * face its owner. The rail and the lands hug the mat's outer edge, and creatures push inward
 * toward the middle of the table — the same way a physical mat is laid out from the seat behind it.
 *
 * The battlefield itself is three named zones (see `battlefieldZones.ts`), all three always drawn
 * so nothing shifts band as the board fills.
 *
 * Both flips are entirely CSS: `.mat.lands-bottom` reverses the zone order, `.mat.rail-right`
 * reverses the rail and the board. So there is one component and one child order no matter which
 * quadrant the mat lands in.
 *
 * The active player's mat is ringed (see `turnStatus.ts`) — a glow rather than a hairline border,
 * so it survives being zoomed out to where 3px is one pixel.
 */
export function Board({
  player,
  seat,
  turn,
  counts,
  battlefield,
  commandZone,
  allCommanders,
  commanderCastCount,
  onTapToggle,
  onCastCommander,
  onObjectContextMenu,
}: BoardProps) {
  // Type lines have to be known here, not down in each tile, to decide which zone a permanent
  // belongs to. A card whose data is still loading lands in the middle zone and moves itself
  // once it arrives.
  const cards = useCards(battlefield);
  const zones = groupByZone(battlefield, (obj) => typeLineOf(obj, cards.get(obj.id) ?? null));

  return (
    <div
      className={`mat lands-${seat.landsSide} rail-${seat.railSide} ${turn ? `turn-${turn}` : ''} ${player.status !== 'active' ? 'eliminated' : ''}`}
      style={{ gridArea: seat.gridArea }}
      // What the plane glides to when "follow the active player" is on (see Plane.tsx). On the
      // mat rather than the board, so following someone frames their rail along with their cards.
      data-focus={player.id}
    >
      <PlayerRail
        player={player}
        turn={turn}
        counts={counts}
        commandZone={commandZone}
        allCommanders={allCommanders}
        commanderCastCount={commanderCastCount}
        onCastCommander={onCastCommander}
        onObjectContextMenu={onObjectContextMenu}
      />

      <div className="board">
        {/* DOM order is outer-edge-first; `.mat.lands-bottom` reverses it in CSS. */}
        <div className="battlefield">
          {ZONES.map((zone) => (
            <section key={zone.key} className={`bf-zone bf-zone-${zone.key}`}>
              <span className="bf-zone-label">{zone.label}</span>
              {zone.key === 'lands'
                ? // Identical basics are fanned into one stack rather than given a tile each.
                  stackLands(zones.lands, (obj) => ({
                    name: stackNameOf(obj, cards.get(obj.id) ?? null),
                    tapped: obj.tapped,
                  })).map((stack) => (
                    <div key={stack.key} className="land-stack">
                      {stack.objects.map((obj) => (
                        <BattlefieldSlot
                          key={obj.id}
                          obj={obj}
                          produces={producedMana(cards.get(obj.id) ?? null)}
                          onTapToggle={onTapToggle}
                          onContextMenu={onObjectContextMenu(obj)}
                        />
                      ))}
                      {stack.objects.length > 1 && <span className="stack-count">×{stack.objects.length}</span>}
                    </div>
                  ))
                : zones[zone.key].map((obj) => (
                    <BattlefieldSlot
                      key={obj.id}
                      obj={obj}
                      produces={producedMana(cards.get(obj.id) ?? null)}
                      onTapToggle={onTapToggle}
                      onContextMenu={onObjectContextMenu(obj)}
                    />
                  ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Sending a permanent to the graveyard is right-click → "Move to graveyard" (see ContextMenu). */
function BattlefieldSlot({
  obj,
  produces,
  onTapToggle,
  onContextMenu,
}: {
  obj: ProjectedObject;
  produces: ManaColor[];
  onTapToggle: (obj: { id: string; tapped: boolean }, produces: ManaColor[], e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const selected = useUiStore((s) => s.selectedIds.has(obj.id));
  const toggleSelected = useUiStore((s) => s.toggleSelected);
  const act = useStore((s) => s.act);

  // An armed target or block arrow never reaches this handler: CardTile takes the click first.
  function onClick(e: React.MouseEvent) {
    // The second click of a double-click: nothing is optimistic, so both clicks read the card as
    // untapped and the land was tapped twice, filling the pad with two mana. Double-click is what
    // the hand now asks for, so it is the habit people bring to the board.
    if (e.detail > 1) return;
    if (e.shiftKey) toggleSelected(obj.id);
    else onTapToggle(obj, produces, e);
  }

  return (
    <CardTile
      obj={obj}
      selected={selected}
      onClick={onClick}
      onContextMenu={onContextMenu}
      // Only on the battlefield: a label matters where the permanent is, and the zone popovers
      // are for reading a pile, not editing it.
      onRemoveLabel={(marker) => act({ t: 'CLEAR_MARKER', objectId: obj.id, marker })}
    />
  );
}
