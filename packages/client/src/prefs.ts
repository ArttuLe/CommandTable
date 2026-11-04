// How the table looks to you: a theme, a playmat and a card back, picked in the settings gear.
// Yours alone — nobody else at the table sees them — so they live in this browser's localStorage
// rather than going anywhere near the server, and outlive every game.
//
// Each is a data attribute on <html> that tokens.css answers (see applyPrefs). The first entry of
// each list is the default, and the one tokens.css needs no rule for.

export const THEMES = ['C', 'W', 'U', 'B', 'R', 'G'] as const;
export const PLAYMATS = ['slate', 'felt', 'wine', 'navy'] as const;
export const CARD_BACKS = ['violet', 'crimson', 'emerald', 'onyx'] as const;

export interface Prefs {
  theme: (typeof THEMES)[number];
  playmat: (typeof PLAYMATS)[number];
  cardBack: (typeof CARD_BACKS)[number];
}

export const DEFAULT_PREFS: Prefs = { theme: THEMES[0], playmat: PLAYMATS[0], cardBack: CARD_BACKS[0] };

const PREFS_KEY = 'command-table-prefs';

/** `value` if it is one of `options`, else the default — a stale or hand-edited entry falls back. */
function oneOf<T extends string>(options: readonly T[], value: unknown): T {
  return options.includes(value as T) ? (value as T) : options[0];
}

// Storage is injected for the tests, as in session.ts: vitest's node environment has none.
export function loadPrefs(storage: Storage = window.localStorage): Prefs {
  let stored: Partial<Prefs> = {};
  try {
    stored = JSON.parse(storage.getItem(PREFS_KEY) ?? '{}') ?? {};
  } catch {
    // Unreadable: every field takes its default below.
  }
  return {
    theme: oneOf(THEMES, stored.theme),
    playmat: oneOf(PLAYMATS, stored.playmat),
    cardBack: oneOf(CARD_BACKS, stored.cardBack),
  };
}

export function savePrefs(prefs: Prefs, storage: Storage = window.localStorage): void {
  storage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/** Puts the prefs on <html>, where tokens.css picks them up. */
export function applyPrefs(prefs: Prefs, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = prefs.theme;
  root.dataset.playmat = prefs.playmat;
  root.dataset.cardBack = prefs.cardBack;
}
