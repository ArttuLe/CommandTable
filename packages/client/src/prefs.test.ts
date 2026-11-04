import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, loadPrefs, savePrefs } from './prefs.js';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe('prefs', () => {
  it('are the defaults when nothing is stored', () => {
    expect(loadPrefs(memoryStorage())).toEqual(DEFAULT_PREFS);
  });

  it('round-trip', () => {
    const storage = memoryStorage();
    const prefs = { theme: 'B', playmat: 'wine', cardBack: 'onyx' } as const;
    savePrefs(prefs, storage);
    expect(loadPrefs(storage)).toEqual(prefs);
  });

  it('fall back field by field when an entry is unknown', () => {
    const storage = memoryStorage({ 'command-table-prefs': JSON.stringify({ theme: 'X', playmat: 'felt' }) });
    expect(loadPrefs(storage)).toEqual({ ...DEFAULT_PREFS, playmat: 'felt' });
  });

  it('are the defaults when the entry is unreadable', () => {
    expect(loadPrefs(memoryStorage({ 'command-table-prefs': '{not json' }))).toEqual(DEFAULT_PREFS);
  });
});
