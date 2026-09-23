// What this browser needs to get its seat back: room, name, rejoin token, passphrase.
//
// Stored in localStorage rather than sessionStorage so that closing the tab — or the whole
// browser — isn't the same as leaving the table. localStorage is shared across tabs in one
// profile though, so a second tab opened for local two-player testing would otherwise read the
// first tab's session and take its seat. Hence the sessionStorage marker: only the tab that owns
// the session resumes it, and only silently, on refresh. Any other tab just shows the normal
// join form — typing your name and the room code reclaims your seat anyway (roomManager.ts), so
// there is nothing to prompt about.

const SESSION_KEY = 'command-table-session';
const TAB_KEY = 'command-table-tab';
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
  storages.local.setItem(SESSION_KEY, JSON.stringify(session));
  storages.tab.setItem(TAB_KEY, session.roomId);
}

export function loadSession(storages: Storages = defaultStorages()): LoadedSession | null {
  const raw = storages.local.getItem(SESSION_KEY);
  if (!raw) return null;

  let session: StoredSession;
  try {
    session = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!session?.roomId || !session.rejoinToken) return null;

  return { session, sameTab: storages.tab.getItem(TAB_KEY) === session.roomId };
}

export function clearSession(storages: Storages = defaultStorages()): void {
  storages.local.removeItem(SESSION_KEY);
  storages.tab.removeItem(TAB_KEY);
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

// Home prefills the passphrase field so a returning player doesn't retype it.
export function storedSecret(storages: Storages = defaultStorages()): string {
  return loadSession(storages)?.session.secret ?? '';
}
