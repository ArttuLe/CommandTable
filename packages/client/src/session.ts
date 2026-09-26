// What this browser needs to get its seat back: room, name, rejoin token, passphrase.
//
// Stored in localStorage rather than sessionStorage so that closing the tab — or the whole
// browser — isn't the same as leaving the table. localStorage is shared across tabs in one
// profile though, so a second tab opened for local two-player testing would otherwise read the
// first tab's session and take its seat. Hence the sessionStorage marker: only the tab that owns
// the session resumes it, and only silently, on refresh. Any other tab just shows the normal
// join form — typing your name and the room code reclaims your seat anyway (roomManager.ts), so
// there is nothing to prompt about.
//
// The passphrase is the exception: it goes in sessionStorage beside the marker, never in
// localStorage. It is the one piece of authentication in the stack (hostSecret.ts) and it does
// not belong in storage that outlives the browser. Nothing is lost by it — the only silent
// resume is the tab that still holds the marker, and that tab still holds the passphrase too.

const SESSION_KEY = 'command-table-session';
const TAB_KEY = 'command-table-tab';
const SECRET_KEY = 'command-table-secret';
const DECKLIST_KEY = 'command-table-decklist';

export interface StoredSession {
  roomId: string;
  displayName: string;
  rejoinToken: string;
  secret: string;
}

export interface LoadedSession {
  session: StoredSession;
  sameTab: boolean;
}

// Injected rather than mocked, matching how the rest of the codebase handles ambient dependencies
// (createTableState takes { randomInt }). Tests run under vitest's node environment, which has no
// localStorage at all.
export interface Storages {
  local: Storage;
  tab: Storage;
}

function defaultStorages(): Storages {
  return { local: window.localStorage, tab: window.sessionStorage };
}

export function saveSession(session: StoredSession, storages: Storages = defaultStorages()): void {
  const { secret, ...persisted } = session;
  storages.local.setItem(SESSION_KEY, JSON.stringify(persisted));
  storages.tab.setItem(TAB_KEY, session.roomId);
  storages.tab.setItem(SECRET_KEY, secret);
}

export function loadSession(storages: Storages = defaultStorages()): LoadedSession | null {
  const raw = storages.local.getItem(SESSION_KEY);
  if (!raw) return null;

  let persisted: Omit<StoredSession, 'secret'>;
  try {
    persisted = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!persisted?.roomId || !persisted.rejoinToken) return null;

  // Empty for a tab that no longer has the passphrase, which is also a tab that will not resume
  // silently — so the credentials are never handed out half-complete.
  const session = { ...persisted, secret: storages.tab.getItem(SECRET_KEY) ?? '' };
  return { session, sameTab: storages.tab.getItem(TAB_KEY) === session.roomId };
}

export function clearSession(storages: Storages = defaultStorages()): void {
  storages.local.removeItem(SESSION_KEY);
  storages.tab.removeItem(TAB_KEY);
  storages.tab.removeItem(SECRET_KEY);
}

// Your decklist outlives the game it was pasted into: ending a game returns everyone to the
// lobby, and re-pasting a hundred lines to play again would be the most tedious part of the
// evening. Kept out of the session blob on purpose — it is not tied to a room or a seat, and
// clearSession (leaving a table) must not throw your deck away.
export function saveDecklist(list: string, storages: Storages = defaultStorages()): void {
  storages.local.setItem(DECKLIST_KEY, list);
}

export function storedDecklist(storages: Storages = defaultStorages()): string {
  return storages.local.getItem(DECKLIST_KEY) ?? '';
}

// Home prefills the passphrase field so a returning player doesn't retype it — within the tab
// that already typed it once. A fresh browser gets an empty field, which is the point.
export function storedSecret(storages: Storages = defaultStorages()): string {
  return storages.tab.getItem(SECRET_KEY) ?? '';
}
