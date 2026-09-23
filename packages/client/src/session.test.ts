import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, loadSession, saveDecklist, saveSession, storedDecklist, storedSecret, type Storages } from './session.js';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

const SESSION = { roomId: 'ABC123', displayName: 'Alice', rejoinToken: 'tok-1', secret: 'forest3' };

describe('session storage', () => {
  let storages: Storages;

  beforeEach(() => {
    storages = { local: memoryStorage(), tab: memoryStorage() };
  });

  it('returns null when nothing is stored', () => {
    expect(loadSession(storages)).toBeNull();
  });

  it('round-trips a session', () => {
    saveSession(SESSION, storages);
    expect(loadSession(storages)?.session).toEqual(SESSION);
  });

  // The refresh case: same tab, so the app resumes without asking.
  it('reports sameTab for the tab that saved the session', () => {
    saveSession(SESSION, storages);
    expect(loadSession(storages)?.sameTab).toBe(true);
  });

  // A reopened or second tab: the session is readable, but it is not this tab's seat to take
  // silently, so nothing is resumed and the normal join form is shown.
  it('reports sameTab false for a tab without the marker', () => {
    saveSession(SESSION, storages);
    const otherTab: Storages = { local: storages.local, tab: memoryStorage() };

    expect(loadSession(otherTab)?.sameTab).toBe(false);
  });

  it('clears both the session and the tab marker', () => {
    saveSession(SESSION, storages);
    clearSession(storages);

    expect(loadSession(storages)).toBeNull();
    const sameLocal: Storages = { local: storages.local, tab: memoryStorage() };
    expect(loadSession(sameLocal)).toBeNull();
  });

  it('ignores a corrupt or half-written entry rather than throwing', () => {
    storages.local.setItem('command-table-session', '{not json');
    expect(loadSession(storages)).toBeNull();

    storages.local.setItem('command-table-session', '{"displayName":"Alice"}');
    expect(loadSession(storages)).toBeNull();
  });

  it('exposes the stored passphrase for prefilling, and empty string when there is none', () => {
    expect(storedSecret(storages)).toBe('');
    saveSession(SESSION, storages);
    expect(storedSecret(storages)).toBe('forest3');
  });
});

describe('decklist storage', () => {
  let storages: Storages;

  beforeEach(() => {
    storages = { local: memoryStorage(), tab: memoryStorage() };
  });

  it('is empty before anything is saved', () => {
    expect(storedDecklist(storages)).toBe('');
  });

  it('round-trips a decklist', () => {
    saveDecklist('1 Sol Ring\n99 Island', storages);
    expect(storedDecklist(storages)).toBe('1 Sol Ring\n99 Island');
  });

  // Leaving a table is not the same as throwing your deck away — you will want it next game.
  it('survives clearSession', () => {
    saveSession(SESSION, storages);
    saveDecklist('1 Sol Ring', storages);

    clearSession(storages);

    expect(storedDecklist(storages)).toBe('1 Sol Ring');
  });
});
