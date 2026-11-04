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
