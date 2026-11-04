import { useEffect, useRef } from 'react';
import { blockMarker, isRedacted, targetMarker, type Card, type GameObject, type ProjectedObject } from '@command-table/common';
import { useCard } from './useCard.js';
import { useStore } from './store.js';
import { counterBadgeText, counterKind } from './counters.js';
import { labelTone } from './labels.js';
import { isCreature, powerToughness, typeLineOf } from './battlefieldZones.js';
import { useUiStore } from './uiStore.js';
import { isAttacking, isLabelMarker, isSummoningSick } from './combat.js';
import { SummoningSickIcon } from './icons.js';

interface CardTileProps {
  obj: ProjectedObject;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  /** The hand's gesture for playing a card (§16.2); a single click there only looks at it. */
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Omitted where a tile is a picture rather than a control — the zone popovers, mainly. */
  onRemoveLabel?: (marker: string) => void;
}

export function CardTile({ obj, selected, onClick, onDoubleClick, onContextMenu, onRemoveLabel }: CardTileProps) {
  const card = useCard(obj);
  const setHoveredCard = useUiStore((s) => s.setHoveredCard);
  const pointing = useUiStore((s) => s.pointing);
  const cancelPointing = useUiStore((s) => s.cancelPointing);
  const act = useStore((s) => s.act);

  // The revision this tile last changed in, or null if the last action left it alone. The
  // revision is the value rather than a boolean because it is what remounts the overlay below.
  const flashRevision = useStore((s) => (s.changedIds.has(obj.id) ? s.changeRevision : null));

  // A tile that unmounts under the cursor never gets its mouseleave, and playing a card from hand
  // is exactly that — the preview stayed up over your own life total until you happened to hover
  // another card. So the tile that put the preview up takes it down on the way out. Tracked per
  // tile rather than by comparing cards: two Forests share one card, and the one leaving must not
  // take down the preview of the one you are now pointing at.
  const showingPreview = useRef(false);
  useEffect(
    () => () => {
      if (showingPreview.current) setHoveredCard(null);
    },
    [setHoveredCard]
  );

  // While "Target…" or "Blocking…" is armed, the next click points the arrow instead of doing
  // whatever this tile normally does. Which marker it writes is the only difference between the
  // two modes. It lives here, at the one chokepoint every tile in the app goes through, because
  // in a mode the mode owns the click: the crosshair cursor is on the hand, the command zone and
  // the zone popovers too, and those used to go on playing and casting out from under an armed
  // arrow — two unintended actions from one click.
  //
  // A double-click is two clicks first, and the first of them is the one that points — which
  // stands the mode down, so the double-click arrives with nothing armed. Whether this gesture
  // started out pointing is remembered from its first press, so it can't go on to play the card.
  const pointedThisGesture = useRef(false);
  function handleClick(e: React.MouseEvent) {
    if (!pointing) {
      onClick?.(e);
      return;
    }
    pointedThisGesture.current = true;
    // Pointing at yourself is the gesture for "never mind", and avoids an arrow with no length.
    if (pointing.fromId !== obj.id) {
      const marker = pointing.kind === 'block' ? blockMarker(obj.id) : targetMarker(obj.id);
      act({ t: 'SET_MARKER', objectId: pointing.fromId, marker });
    }
    cancelPointing();
  }

  // The keyboard's way into the same handlers the mouse uses: Enter is the tile's own click (or
  // double-click, in the hand), and the context-menu key is its right-click. Dispatched as real
  // mouse events at the tile's centre rather than calling the props, because the handlers read
  // where the click landed — a dual land asks which colour at that point — and because a click
  // in a mode has to go through handleClick like any other.
  const tileRef = useRef<HTMLDivElement>(null);
  const interactive = Boolean(onClick || onDoubleClick || onContextMenu);
  function fire(type: 'click' | 'dblclick' | 'contextmenu') {
    const el = tileRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent(type, { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })
    );
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!pointing && onDoubleClick) {
        // No mouse-down came first to reset it, and Enter is never the end of a pointing gesture.
        pointedThisGesture.current = false;
        fire('dblclick');
      } else {
        fire('click');
      }
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      fire('contextmenu');
    }
  }

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
      ref={tileRef}
      className={`card-tile ${obj.tapped ? 'tapped' : ''} ${showsBack ? 'face-down' : ''} ${selected ? 'selected' : ''} ${isAttacking(obj) ? 'attacking' : ''}`}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`${label ?? (showsBack ? 'Face-down card' : 'Card')}${obj.tapped ? ', tapped' : ''}`}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onMouseDown={(e) => {
        if (e.detail === 1) pointedThisGesture.current = false;
      }}
      onClick={handleClick}
      onDoubleClick={() => {
        if (!pointedThisGesture.current) onDoubleClick?.();
      }}
      onContextMenu={onContextMenu}
      // Hover-zoom is left alone: if the projection let you have the card, you are allowed to
      // remind yourself what your own morph is without turning it over for everyone.
      onMouseEnter={() => {
        if (!card) return;
        setHoveredCard(card);
        showingPreview.current = true;
      }}
      onMouseLeave={() => {
        setHoveredCard(null);
        showingPreview.current = false;
      }}
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
          <SummoningSickIcon />
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
      {/* An overlay child rather than a class on the tile: this card just changed and the pulse
          says so to everyone at once, but it must not touch the tile's own `transform`, which is
          load-bearing for a tapped card's rotation and for the hand's hover-lift. The `key` is
          what remounts the element, and so restarts the animation when the same card changes
          twice running. */}
      {flashRevision !== null && <span key={flashRevision} className="change-pulse" />}
    </div>
  );
}

function cardLabel(obj: GameObject, card: Card | null): string {
  if (card) return card.name;
  if (obj.source.kind === 'token' && obj.source.adhoc) return obj.source.adhoc.name;
  return 'Loading…';
}
