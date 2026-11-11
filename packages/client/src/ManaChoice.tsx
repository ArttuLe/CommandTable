// Which colour a dual just made.
//
// Tapping a permanent that can only add one symbol fills the pad on the spot (see Table); this is
// for the ones that can't be read that plainly — a dual land, a Command Tower. The tap itself has
// already happened, so dismissing this adds no mana rather than undoing anything.

import { useLayoutEffect, useRef, useState } from 'react';
import { placeMenu } from './menuPlacement.js';
import { ManaEmblem } from './icons.js';
import { MANA_NAMES, type ManaColor } from './uiStore.js';

export interface ManaChoicePrompt {
  colors: ManaColor[];
  x: number;
  y: number;
}

export function ManaChoice({
  prompt,
  onChoose,
  onClose,
}: {
  prompt: ManaChoicePrompt;
  onChoose: (color: ManaColor) => void;
  onClose: () => void;
}) {
  // Same measure-then-place as ContextMenu: the width depends on how many colours this card
  // offers, so there is nothing to flip against until it has rendered once.
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos(
      placeMenu(
        { x: prompt.x, y: prompt.y },
        { width, height },
        { width: window.innerWidth, height: window.innerHeight }
      )
    );
  }, [prompt]);

  return (
    <>
      <div className="context-menu-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={ref}
        className="mana-choice"
        style={{ left: pos?.left ?? prompt.x, top: pos?.top ?? prompt.y, visibility: pos ? 'visible' : 'hidden' }}
      >
        {prompt.colors.map((color) => (
          <button
            key={color}
            className={`mana-${color}`}
            title={`Add ${MANA_NAMES[color]}`}
            aria-label={`Add one ${MANA_NAMES[color]} mana`}
            onClick={() => {
              onChoose(color);
              onClose();
            }}
          >
            <b className="mana-symbol" aria-hidden="true">
              <ManaEmblem color={color} />
            </b>
          </button>
        ))}
      </div>
    </>
  );
}
