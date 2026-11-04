// What the help dialog (`?` in the status bar) lists. Kept as data rather than baked into the
// dialog's markup so the two halves — keys and gestures — read as one table.
//
// The keys themselves are handled by Table's `onKeyDown`; this list has to be kept in step with
// that switch by hand. Driving the switch from here would mean an action map per entry, which is
// more indirection than six shortcuts are worth. The exceptions are the hover moves and the
// signals below, which are data the switch reads too.

import type { Action, PlayerId, ProjectedObject } from '@command-table/common';
import type { MoveTarget } from './cardMenu.js';

/** Keys that send the card under the cursor somewhere, as the context menu's chips would. */
const HOVER_MOVES: Record<string, MoveTarget['zone']> = { g: 'graveyard', e: 'exile', h: 'hand' };

/**
 * What a hover-move key does to the card under the cursor, or null for nothing. Only your own
 * cards: the menu can move anyone's, but a key is pressed far more casually than a menu item is
 * picked, and a slip should not send someone else's commander to the graveyard.
 */
export function hoverMove(key: string, obj: Pick<ProjectedObject, 'id' | 'controllerId' | 'zone'>, playerId: PlayerId): Action | null {
  const zone = HOVER_MOVES[key];
  if (!zone || obj.controllerId !== playerId || obj.zone.zone === zone) return null;
  return { t: 'MOVE_OBJECT', objectId: obj.id, toZone: { playerId, zone } };
}

/**
 * Two things said across a real table so often they get a key each, sent as chat. There's no
 * priority to enforce in freeform play, but "wait, I have a response" still has to be said.
 */
export const SIGNALS = [
  { key: 'r', label: 'Hold on', text: 'Hold on — I have a response' },
  { key: 'k', label: 'Go ahead', text: 'Go ahead' },
];

export interface Shortcut {
  keys: string;
  what: string;
}

export const KEY_SHORTCUTS: Shortcut[] = [
  { keys: 'D', what: 'Draw a card' },
  { keys: 'U', what: 'Untap all your permanents, and empty your mana pad' },
  { keys: 'P', what: 'Pass the turn (confirms first if it is not yours)' },
  { keys: '+ / −', what: 'Gain or lose one life' },
  { keys: 'L', what: 'Open or close the log rail' },
  { keys: 'C', what: 'Open or close the chat rail' },
  { keys: 'Z', what: 'Undo the last action (instant if it was yours, otherwise the table votes)' },
  { keys: 'F', what: 'Fit the whole table on screen' },
  { keys: 'T', what: 'Tap or untap the permanent under the cursor, as a click would' },
  { keys: 'G / E / H', what: 'Send your card under the cursor to the graveyard, exile, or your hand' },
  { keys: 'R / K', what: 'Tell the table "Hold on — I have a response" or "Go ahead"' },
  { keys: 'Esc', what: 'Clear the selection, or close whatever is open' },
];

export const MOUSE_SHORTCUTS: Shortcut[] = [
  { keys: 'Double-click a card in hand', what: 'Play it to your battlefield' },
  { keys: 'Click a permanent', what: 'Tap or untap it — your mana pad follows either way' },
  { keys: 'Right-click any card', what: 'Every action for that object' },
  { keys: 'Shift-click', what: 'Add a permanent to the selection for a bulk action' },
  { keys: 'Hover a card', what: 'Zoom it on the left edge' },
  { keys: 'Drag the table', what: 'Pan; the wheel zooms, and Fit frames everything' },
  { keys: 'Right-click the table', what: 'Zoom, fit, or follow the active player — zooming around the point you clicked' },
  { keys: 'Middle-click the table', what: "Glide the view to whoever's turn it is" },
];

/**
 * The help dialog's first tab: the things people come to the table to do, and how. The lists above
 * name gestures; a first game starts from "how do I cast a spell?", which no list of gestures
 * answers. Each entry has to stay true to the app — it is the only manual most players will read.
 */
export interface HowTo {
  task: string;
  how: string;
}

export const HOW_TOS: HowTo[] = [
  {
    task: 'Play a land or cast a spell',
    how: 'Double-click it in your hand. It lands on your battlefield for everyone to see; once an instant or sorcery has resolved, right-click it and choose GY.',
  },
  {
    task: 'Tap lands for mana',
    how: 'Click a land. What it makes goes into your mana pad above the hand, and a land that makes more than one colour asks which. Untapping takes it back.',
  },
  {
    task: 'Cast your commander',
    how: 'Click it in your rail beside your board. The commander tax is counted for you on its badge; you pay it yourself.',
  },
  {
    task: 'Attack and block',
    how: 'Right-click a creature and choose Attacking. To block, right-click yours, choose Blocking…, then click the attacker. Combat markers clear when the turn passes.',
  },
  {
    task: 'Put counters on a permanent',
    how: 'Right-click it and use the +1/+1, −1/−1 or Counter steppers. Labels (flying, haste, anything) are under Add label….',
  },
  {
    task: 'Search your library, or scry',
    how: 'More ⋯ → Search library, or Peek / Scry…. Every revealed card offers Hand, Play, Top and Bottom, and a search shuffles your library when you close it.',
  },
  {
    task: 'Make tokens',
    how: 'More ⋯ → Create token…. To make more of one already in play, right-click it and choose Duplicate.',
  },
  {
    task: 'Change life, poison or commander damage',
    how: 'Use − and + beside each in your bar, or click your life total to change it by any amount. Commander damage takes the life with it.',
  },
  {
    task: 'Take something back',
    how: 'Undo, or Z. Your own last action reverts at once; anything else asks the table, and everyone sees the vote.',
  },
  {
    task: 'End your turn',
    how: 'Pass turn, or P. The next player untaps and the combat markers clear.',
  },
  {
    task: 'Leave the game',
    how: 'More ⋯ → Concede. Your cards leave the table; when one player is left, the table says who won.',
  },
];
