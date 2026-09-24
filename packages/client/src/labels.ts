// Labels are `markers` (§8.1) — freeform strings the table agrees on, with nothing enforcing them.
// This is the client's opinion about the handful that come up constantly: which ones to offer in
// the picker, and what colour to draw them.
//
// Deliberately a suggestion layer, not a schema. Anything can still be typed by hand; an
// unrecognised label just gets the neutral pill. Structurally the same shape as counters.ts's
// `counterKind`, for the same reason: the component asks "how does this read?" and nothing more.

/** Pill colours. The five are the colour pie; `gold` is for table-wide state that isn't a keyword. */
export type LabelTone = 'white' | 'blue' | 'black' | 'red' | 'green' | 'gold' | 'neutral';

const TONES: Record<string, LabelTone> = {
  // White: the combat keywords that protect and attack on its terms. Flying is white here at the
  // table's request, though it is properly white-blue.
  flying: 'white',
  vigilance: 'white',
  'first strike': 'white',
  'double strike': 'white',
  lifelink: 'white',
  indestructible: 'white',

  flash: 'blue',
  hexproof: 'blue',
  ward: 'blue',

  deathtouch: 'black',
  menace: 'black',

  // Counters that were only ever a word plus a number, moved here where the word is the point
  // (see also loyalty, below).
  stun: 'blue',
  shield: 'white',

  haste: 'red',
  goaded: 'red',

  trample: 'green',
  reach: 'green',

  // Not keywords — table state someone has to remember between turns, which is exactly what a
  // marker is for. Loyalty is here because the number is the nameless counter's job now; the
  // word is all that was left of it.
  monarch: 'gold',
  initiative: 'gold',
  loyalty: 'gold',
};

/** What to offer in the picker, in the order it reads best — grouped by tone, not alphabetised. */
export const LABEL_PRESETS: string[] = [
  'flying',
  'vigilance',
  'first strike',
  'double strike',
  'lifelink',
  'indestructible',
  'flash',
  'hexproof',
  'ward',
  'deathtouch',
  'menace',
  'stun',
  'shield',
  'haste',
  'goaded',
  'trample',
  'reach',
  'monarch',
  'initiative',
  'loyalty',
];

/** Case and stray spaces are the player's business, not the pill's. */
export function labelTone(label: string): LabelTone {
  return TONES[label.trim().toLowerCase()] ?? 'neutral';
}
