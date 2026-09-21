import { describe, expect, it } from 'vitest';
import { groupByZone, zoneOf } from './battlefieldZones.js';

describe('zoneOf', () => {
  it('sorts the three broad kinds of permanent', () => {
    expect(zoneOf('Creature — Elf Druid')).toBe('creatures');
    expect(zoneOf('Basic Land — Forest')).toBe('lands');
    expect(zoneOf('Legendary Enchantment')).toBe('permanents');
  });

  it('keeps planeswalkers and battles with the other ongoing permanents', () => {
    expect(zoneOf('Legendary Planeswalker — Teferi')).toBe('permanents');
    expect(zoneOf('Battle — Siege')).toBe('permanents');
    expect(zoneOf('Artifact — Equipment')).toBe('permanents');
  });

  it('puts a card that is several types at once with its creatures', () => {
    expect(zoneOf('Artifact Creature — Golem')).toBe('creatures');
    expect(zoneOf('Land Creature — Forest Dryad')).toBe('creatures');
  });

  it('parks a card whose data has not loaded in the middle band', () => {
    // It self-corrects the moment the type line arrives; the middle is the least jarring
    // place to wait, being adjacent to both other zones.
    expect(zoneOf(null)).toBe('permanents');
  });
});

describe('groupByZone', () => {
  // Generic over the object type, so these fixtures stay readable — the real call passes
  // ProjectedObject[] straight through.
  const typeLines: Record<string, string> = {
    a: 'Creature — Bear',
    b: 'Basic Land — Island',
    c: 'Creature — Bird',
    d: 'Artifact',
  };
  const lineOf = (o: { id: string }) => typeLines[o.id] ?? null;

  it('splits objects into all three zones, preserving order within each', () => {
    const result = groupByZone([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], lineOf);

    expect(result.creatures.map((o) => o.id)).toEqual(['a', 'c']);
    expect(result.lands.map((o) => o.id)).toEqual(['b']);
    expect(result.permanents.map((o) => o.id)).toEqual(['d']);
  });

  it('returns every zone even on an empty battlefield, since each one is always drawn', () => {
    expect(groupByZone([], () => null)).toEqual({ lands: [], permanents: [], creatures: [] });
  });
});
