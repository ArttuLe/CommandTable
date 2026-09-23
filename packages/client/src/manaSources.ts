// What a permanent puts in your mana pad when you tap it, and takes back when you untap it.
//
// The pad (§8.4) is client-local and the server has no concept of mana, so this is read off the
// card's own oracle text rather than tracked anywhere: every "Add …" clause on the card, reduced
// to the distinct symbols it could produce. One symbol is added on the spot; more than one is a
// choice (see ManaChoice), because a dual is a choice.
//
// Deliberately approximate. It reads what a card *could* add, not what tapping it actually costs
// or produces — a land that adds two different colours at once offers them as a choice, and a
// card with an expensive activated ability is offered as freely as a basic. The pad is a notepad
// you can always correct by hand; the point is to save the common land drop three clicks.

import type { Card } from '@command-table/common';
import type { ManaColor } from './uiStore.js';

const ANY_COLOR: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

/** Everything after an "Add", up to the end of that sentence — where the produced symbols are. */
const ADD_CLAUSE = /\bAdd\b([^.]*)/g;
const MANA_SYMBOL = /\{([WUBRGC])\}/g;

export function producedMana(card: Card | null): ManaColor[] {
  const text = card?.oracleText;
  if (!text) return [];

  const produced: ManaColor[] = [];
  const add = (color: ManaColor) => {
    if (!produced.includes(color)) produced.push(color);
  };

  for (const [, clause] of text.matchAll(ADD_CLAUSE)) {
    // "one mana of any color" names no symbol of its own, so it has to be spelled out.
    if (/any colou?r/i.test(clause)) ANY_COLOR.forEach(add);
    for (const [, symbol] of clause.matchAll(MANA_SYMBOL)) add(symbol as ManaColor);
  }

  return produced;
}

/**
 * Which colour to take back out of the pad when a source is untapped — undoing the tap that put
 * it there, for the common case of tapping the wrong land and clicking it again.
 *
 * Nothing records which colour a dual actually made, so this picks one you are holding, in the
 * source's own order. Storing the choice per object would be exact right up until the mana is
 * spent, the object leaves the battlefield, or the pad is reset out from under it — three ways
 * for a remembered colour to outlive the thing it described. Guessing from the pad is wrong less
 * often than stale state is, and is wrong in a way one click on a pip corrects.
 */
export function manaToRemove(produces: ManaColor[], pad: Record<ManaColor, number>): ManaColor | null {
  return produces.find((color) => pad[color] > 0) ?? null;
}
