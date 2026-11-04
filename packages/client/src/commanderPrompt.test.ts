import { describe, expect, it } from 'vitest';
import type { ProjectedObject, ZoneRef } from '@command-table/common';
import { commanderPrompts, spentDismissals } from './commanderPrompt.js';

function at(zone: ZoneRef): ProjectedObject {
  return {
    id: 'cmd',
    zone,
    controllerId: 'alice',
    tapped: false,
    counters: {},
    attachedTo: null,
    markers: [],
    hidden: true,
  };
}

const objects = (zone: ZoneRef) => ({ cmd: at(zone) });

describe('commanderPrompts', () => {
  it('offers the command zone to a commander in the graveyard or in exile', () => {
    expect(commanderPrompts(objects({ playerId: 'alice', zone: 'graveyard' }), ['cmd'], {})).toEqual([
      { objectId: 'cmd', zone: 'graveyard' },
    ]);
    expect(commanderPrompts(objects({ playerId: 'alice', zone: 'exile' }), ['cmd'], {})).toEqual([
      { objectId: 'cmd', zone: 'exile' },
    ]);
  });

  it('stays quiet while the commander is anywhere it belongs', () => {
    for (const zone of ['battlefield', 'commandZone', 'hand', 'library'] as const) {
      expect(commanderPrompts(objects({ playerId: 'alice', zone }), ['cmd'], {})).toEqual([]);
    }
    expect(commanderPrompts(objects({ zone: 'stack' }), ['cmd'], {})).toEqual([]);
  });

  it('stays quiet about a commander it cannot see at all', () => {
    expect(commanderPrompts({}, ['cmd'], {})).toEqual([]);
  });

  it('stops asking once the offer is waved away for that zone', () => {
    const graveyard = objects({ playerId: 'alice', zone: 'graveyard' });
    expect(commanderPrompts(graveyard, ['cmd'], { cmd: 'graveyard' })).toEqual([]);
  });

  it('asks again when the same commander moves on to a different zone', () => {
    const exile = objects({ playerId: 'alice', zone: 'exile' });
    expect(commanderPrompts(exile, ['cmd'], { cmd: 'graveyard' })).toEqual([{ objectId: 'cmd', zone: 'exile' }]);
  });

  it('asks about each partner separately', () => {
    const both = {
      a: { ...at({ playerId: 'alice', zone: 'graveyard' }), id: 'a' },
      b: { ...at({ playerId: 'alice', zone: 'exile' }), id: 'b' },
    };
    expect(commanderPrompts(both, ['a', 'b'], {})).toHaveLength(2);
  });
});

// "Leave it" is for this time. Kept after the commander moved on, it silenced the offer for good.
describe('spentDismissals', () => {
  it('spends a dismissal once the commander has left the zone it was left in', () => {
    expect(spentDismissals(objects({ playerId: 'alice', zone: 'graveyard' }), { cmd: 'graveyard' })).toEqual([]);
    expect(spentDismissals(objects({ playerId: 'alice', zone: 'battlefield' }), { cmd: 'graveyard' })).toEqual(['cmd']);
    expect(spentDismissals(objects({ playerId: 'alice', zone: 'exile' }), { cmd: 'graveyard' })).toEqual(['cmd']);
  });
});
