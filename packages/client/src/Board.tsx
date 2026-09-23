import { blockMarker, isRedacted, targetMarker, type GameObject, type PlayerState, type ProjectedObject } from '@command-table/common';
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

export interface BoardProps {
  player: PlayerState;
  seat: Seat;
  turn: TurnHighlight;
  handCount: number;
  libraryCount: number;
  battlefield: ProjectedObject[];
  commandZone: ProjectedObject[];
  commanderCastCount: Record<string, number>;
  /** The second argument is what tapping would put in the mana pad (see manaSources.ts). */
  onTapToggle: (obj: { id: string; tapped: boolean }, produces: ManaColor[], e: React.MouseEvent) => void;
  onCastCommander?: (obj: GameObject) => void;
  onObjectContextMenu: (obj: ProjectedObject) => (e: React.MouseEvent) => void;
}

/**
 * One player's mat on the plane, oriented to face its owner: the header and command zone sit
 * against the board's outer edge with the lands, and creatures push inward toward the
 * crossroads — the same way a physical mat is laid out from the seat behind it.
 *
 * The battlefield itself is three named zones (see `battlefieldZones.ts`), all three always
 * drawn so nothing shifts band as the board fills.
 *
 * The flip is entirely CSS: a bottom-row board reverses both its own column and its zone
 * order, so there is one component and one child order regardless of which quadrant it lands in.
 *
 * The active player's mat is ringed (see `turnStatus.ts`) — a glow rather than a hairline border,
 * so it survives being zoomed out to where 3px is one pixel.
 */
export function Board({
  player,
  seat,
  turn,
  handCount,
  libraryCount,
  battlefield,
  commandZone,
  commanderCastCount,
  onTapToggle,
  onCastCommander,
  onObjectContextMenu,
}: BoardProps) {
  // Type lines have to be known here, not down in each tile, to decide which zone a permanent
  // belongs to. A card whose data is still loading lands in the middle zone and moves itself
  // once it arrives (§16.1's original note about async card data still applies).
  const cards = useCards(battlefield);
  const zones = groupByZone(battlefield, (obj) => typeLineOf(obj, cards.get(obj.id) ?? null));

  return (
    <div
      className={`board lands-${seat.landsSide} ${turn ? `turn-${turn}` : ''} ${player.status !== 'active' ? 'eliminated' : ''}`}
      style={{ gridArea: seat.gridArea }}
      // What the plane glides to when "follow the active player" is on (see Plane.tsx).
      data-focus={player.id}
    >
      {/* The command zone rides in the header at reduced scale rather than taking a band of its
          own. A commander waiting to be cast is a single card that was costing as much height as
          a whole row of permanents; off to the side by the player's name is also where a command
          zone sits on a physical table. */}
      <div className="board-header">
        <span className="player-name">{player.displayName}</span>
        {turn && <span className="turn-badge">{turn === 'mine' ? 'Your turn' : 'Their turn'}</span>}
        {/* Mulligans are otherwise invisible: the action swaps your hand out and says nothing.
            The server already tracks the count (playerActions.mulligan). */}
        <span className="counts">
          Hand: {handCount} · Library: {libraryCount}
          {(player.counters.mulligan ?? 0) > 0 && ` · Mulligans: ${player.counters.mulligan}`}
        </span>

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
      </div>

      {/* DOM order is outer-edge-first; `.board.lands-bottom` reverses it in CSS. */}
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
  const pointing = useUiStore((s) => s.pointing);
  const cancelPointing = useUiStore((s) => s.cancelPointing);
  const act = useStore((s) => s.act);

  // While "Target…" or "Blocking…" is armed, the next click points the arrow instead of tapping
  // the permanent. Which marker it writes is the only difference between the two modes.
  function onClick(e: React.MouseEvent) {
    if (pointing) {
      // Pointing at yourself is the gesture for "never mind", and avoids an arrow with no length.
      if (pointing.fromId !== obj.id) {
        const marker = pointing.kind === 'block' ? blockMarker(obj.id) : targetMarker(obj.id);
        act({ t: 'SET_MARKER', objectId: pointing.fromId, marker });
      }
      cancelPointing();
      return;
    }
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
