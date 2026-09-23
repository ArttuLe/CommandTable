import { isRedacted, type Card, type GameObject, type ProjectedObject } from '@command-table/common';
import { useCard } from './useCard.js';
import { counterBadgeText, counterKind } from './counters.js';
import { labelTone } from './labels.js';
import { isCreature, powerToughness, typeLineOf } from './battlefieldZones.js';
import { useUiStore } from './uiStore.js';
import { isAttacking, isLabelMarker, isSummoningSick } from './combat.js';

interface CardTileProps {
  obj: ProjectedObject;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Omitted where a tile is a picture rather than a control — the zone popovers, mainly. */
  onRemoveLabel?: (marker: string) => void;
}

export function CardTile({ obj, selected, onClick, onContextMenu, onRemoveLabel }: CardTileProps) {
  const card = useCard(obj);
  const setHoveredCard = useUiStore((s) => s.setHoveredCard);

  const label = isRedacted(obj) ? null : cardLabel(obj, card);
  // Two ways to be looking at a back: the projection withheld the card from you (§9.2), or the
  // card is face down and you happen to be the one allowed to see it anyway. The second used to
  // render its art as normal, which made TURN_FACE_DOWN look like it had done nothing.
  const showsBack = isRedacted(obj) || obj.faceDown;

  // Creature tokens only, and only face up: a real card prints its own P/T on its art, a Clue
  // token has none, and a morph's is the thing its controller is paying to hide.
  const pt = !showsBack && isCreature(typeLineOf(obj, card)) ? powerToughness(obj) : null;

  // The server marks every permanent that arrives on a battlefield, creature or not, because it
  // has no card data to tell them apart (see markers.ts). Only creatures care, so only creatures
  // show it — and the marker is kept out of the label pills either way.
  const sick = isSummoningSick(obj) && isCreature(typeLineOf(obj, card));

  const labels = obj.markers.filter(isLabelMarker);

  return (
    <div
      className={`card-tile ${obj.tapped ? 'tapped' : ''} ${showsBack ? 'face-down' : ''} ${selected ? 'selected' : ''} ${isAttacking(obj) ? 'attacking' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      // Hover-zoom is left alone: if the projection let you have the card, you are allowed to
      // remind yourself what your own morph is without turning it over for everyone.
      onMouseEnter={() => card && setHoveredCard(card)}
      onMouseLeave={() => setHoveredCard(null)}
      title={label ?? undefined}
      // How ArrowLayer finds this tile to measure. Nothing else reads it.
      data-object-id={obj.id}
    >
      {!showsBack && card?.imageUris ? (
        <img src={card.imageUris.normal} alt={card.name} />
      ) : (
        <div className="card-tile-fallback">{showsBack ? '' : (label ?? '?')}</div>
      )}
      {/* One strip rather than a badge per corner: counters used to be stacked on top of each
          other, so a creature with both a +1/+1 and a stun counter only ever showed one. The P/T
          rides in the same strip, pushed to its right end — as an absolutely positioned corner
          badge it would sit under the counters the moment a creature had two of them. */}
      {(Object.keys(obj.counters).length > 0 || pt) && (
        <div className="card-badges">
          {Object.entries(obj.counters).map(([key, value]) => (
            <span key={key} className={`counter-badge counter-${counterKind(key)}`} title={`${key}: ${value}`}>
              {counterBadgeText(key, value)}
            </span>
          ))}
          {pt && <span className="pt-badge">{pt}</span>}
        </div>
      )}
      {/* A corner mark rather than a pill: summoning sickness is on half the board the turn a
          player commits, and nine text badges saying the same thing would bury the labels that
          differ. It clears itself when its controller's next turn starts. */}
      {sick && (
        <span className="sick-badge" title="Summoning sick — arrived this turn">
          ☾
        </span>
      )}
      {/* A strip, like the counters above — these used to be absolutely positioned at the same
          corner, so a creature with two labels showed one label on top of another. The attacking
          marker is excluded: it is the red border, not a pill (see combat.ts).

          Clicking a pill takes the label off. Removing one is also in the context menu, but the
          pill is where you are already looking when you decide it should go. */}
      {labels.length > 0 && (
        <div className="card-labels">
          {labels.map((marker) => (
            <span
              key={marker}
              className={`label-pill label-${labelTone(marker)} ${onRemoveLabel ? 'removable' : ''}`}
              title={onRemoveLabel ? `${marker} — click to remove` : marker}
              onClick={
                onRemoveLabel &&
                ((e) => {
                  // The tile beneath plays the card / taps the permanent; this click meant the pill.
                  e.stopPropagation();
                  onRemoveLabel(marker);
                })
              }
            >
              {marker}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function cardLabel(obj: GameObject, card: Card | null): string {
  if (card) return card.name;
  if (obj.source.kind === 'token' && obj.source.adhoc) return obj.source.adhoc.name;
  return 'Loading…';
}
