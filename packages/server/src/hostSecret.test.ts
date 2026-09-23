import { describe, expect, it } from 'vitest';
import { checkSecret, resolveHostSecret } from './hostSecret.js';

describe('checkSecret', () => {
  it('accepts the matching secret', () => {
    expect(checkSecret('SWAMP7', 'SWAMP7')).toBe(true);
  });

  it('rejects a different secret of the same length', () => {
    expect(checkSecret('SWAMP7', 'ISLAND')).toBe(false);
  });

  it('rejects a secret of a different length', () => {
    expect(checkSecret('SWAMP7', 'SWAMP')).toBe(false);
  });

  it('rejects a missing secret', () => {
    expect(checkSecret('SWAMP7', undefined)).toBe(false);
  });
});

describe('resolveHostSecret', () => {
  it('uses HOST_SECRET when the host set one', () => {
    expect(resolveHostSecret({ HOST_SECRET: 'kitchen table' })).toBe('kitchen table');
  });

  it('generates one when the host set none', () => {
    expect(resolveHostSecret({})).not.toHaveLength(0);
  });

  it('ignores an empty HOST_SECRET rather than leaving the table open', () => {
    expect(resolveHostSecret({ HOST_SECRET: '' })).not.toHaveLength(0);
  });

  it('reuses a persisted secret when HOST_SECRET is unset, so a restart does not lock players out', () => {
    expect(resolveHostSecret({}, 'forest3')).toBe('forest3');
  });

  it('lets an explicit HOST_SECRET override a persisted one', () => {
    expect(resolveHostSecret({ HOST_SECRET: 'chosen' }, 'forest3')).toBe('chosen');
  });

  it('generates a secret when there is neither an env var nor a persisted one', () => {
    expect(resolveHostSecret({}, undefined).length).toBeGreaterThan(0);
  });
});
