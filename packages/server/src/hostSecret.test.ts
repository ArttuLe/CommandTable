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
});
