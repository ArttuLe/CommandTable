// What the help dialog (`?` in the status bar) lists. Kept as data rather than baked into the
// dialog's markup so the two halves — keys and gestures — read as one table.
//
// The keys themselves are handled by Table's `onKeyDown`; this list has to be kept in step with
// that switch by hand. Driving the switch from here would mean an action map per entry, which is
// more indirection than six shortcuts are worth.

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
