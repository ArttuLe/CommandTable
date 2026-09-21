import { describe, expect, it } from 'vitest';
import { EMPTY_TOKEN_FORM, defaultTypeLine, tokenFromForm } from './tokenForm.js';

const form = (fields: Partial<typeof EMPTY_TOKEN_FORM>) => ({ ...EMPTY_TOKEN_FORM, ...fields });

describe('defaultTypeLine', () => {
  it('reads the name as the creature it usually is', () => {
    expect(defaultTypeLine('Squirrel')).toBe('Token Creature — Squirrel');
  });

  it('has nothing to suggest before the name is typed', () => {
    expect(defaultTypeLine('  ')).toBe('');
  });
});

describe('tokenFromForm', () => {
  it('builds a token from the filled-in fields', () => {
    expect(tokenFromForm(form({ name: 'Soldier', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', quantity: '3' })))
      .toEqual({ adhoc: { name: 'Soldier', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1' }, quantity: 3 });
  });

  it('falls back to the suggested type line when that field is left empty', () => {
    expect(tokenFromForm(form({ name: 'Treasure' }))?.adhoc.typeLine).toBe('Token Creature — Treasure');
  });

  it('leaves power and toughness off a token that has none, rather than sending blanks', () => {
    const draft = tokenFromForm(form({ name: 'Clue', typeLine: 'Token Artifact — Clue' }));

    expect(draft?.adhoc.power).toBeUndefined();
    expect(draft?.adhoc.toughness).toBeUndefined();
  });

  it('refuses a nameless token or a quantity that is not a whole number of cards', () => {
    expect(tokenFromForm(form({ name: '   ' }))).toBeNull();
    expect(tokenFromForm(form({ name: 'Zombie', quantity: '0' }))).toBeNull();
    expect(tokenFromForm(form({ name: 'Zombie', quantity: '2.5' }))).toBeNull();
    expect(tokenFromForm(form({ name: 'Zombie', quantity: '' }))).toBeNull();
  });
});
