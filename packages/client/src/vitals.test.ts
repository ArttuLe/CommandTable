import { describe, expect, it } from 'vitest';
import {
  COMMANDER_DAMAGE_LETHAL,
  damageTakenFrom,
  isLethalCommanderDamage,
  isLethalLife,
  isLethalPoison,
  POISON_LETHAL,
  worstDamageTaken,
} from './vitals.js';

describe('isLethalLife', () => {
  it('is lethal once life runs out, not while any is left', () => {
    expect(isLethalLife(1)).toBe(false);
    expect(isLethalLife(0)).toBe(true);
    expect(isLethalLife(-3)).toBe(true);
  });
});

describe('isLethalPoison', () => {
  it('is lethal at the tenth counter, not the ninth', () => {
    expect(isLethalPoison(POISON_LETHAL - 1)).toBe(false);
    expect(isLethalPoison(POISON_LETHAL)).toBe(true);
  });
});

describe('isLethalCommanderDamage', () => {
  it('is lethal at 21 from one commander, not at 20', () => {
    expect(isLethalCommanderDamage(COMMANDER_DAMAGE_LETHAL - 1)).toBe(false);
    expect(isLethalCommanderDamage(COMMANDER_DAMAGE_LETHAL)).toBe(true);
  });
});

const commanders = [{ id: 'atraxa' }, { id: 'korvold' }, { id: 'sisay' }];

describe('damageTakenFrom', () => {
  it('reports only the commanders that have actually landed damage', () => {
    const player = { commanderDamageTaken: { atraxa: 7, korvold: 0 } };
    expect(damageTakenFrom(player, commanders)).toEqual([{ commander: { id: 'atraxa' }, damage: 7 }]);
  });

  it('keeps the order it was given, so badges do not reshuffle as damage lands', () => {
    const player = { commanderDamageTaken: { sisay: 2, atraxa: 7 } };
    expect(damageTakenFrom(player, commanders).map((e) => e.commander.id)).toEqual(['atraxa', 'sisay']);
  });

  it('is empty for an untouched player', () => {
    expect(damageTakenFrom({ commanderDamageTaken: {} }, commanders)).toEqual([]);
  });
});

describe('worstDamageTaken', () => {
  it('is the highest single commander total — what the 21 rule turns on, not the sum', () => {
    expect(worstDamageTaken({ commanderDamageTaken: { atraxa: 12, korvold: 15 } })).toBe(15);
  });

  it('is zero before anyone has connected', () => {
    expect(worstDamageTaken({ commanderDamageTaken: {} })).toBe(0);
  });
});
