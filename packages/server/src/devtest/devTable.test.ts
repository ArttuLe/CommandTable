import { describe, expect, it } from 'vitest';
import type { Card } from '@command-table/common';
import { buildDevTable, devDeckTexts, devSeatName, DEV_PLAYER_NAMES } from './devTable.js';
import { parseDecklist } from '../decklistParser.js';
import { RoomManager } from '../roomManager.js';
import type { CardLookup } from '../deckResolver.js';

// Every name resolves to a card of that name — the deck files are checked against the real index
// by the test below, so what matters here is the shape of the table, not the lookup.
const lookup: CardLookup = {
  findByName: (name) => cardNamed(name),
  findByPrinting: (name) => cardNamed(name),
  suggestNames: () => [],
};

function cardNamed(name: string): Card {
  return {
    scryfallId: `sid-${name}`,
    oracleId: `oid-${name}`,
    name,
    manaCost: null,
    cmc: 0,
    typeLine: 'Creature',
    oracleText: null,
    power: null,
    toughness: null,
    loyalty: null,
    defense: null,
    colors: [],
    colorIdentity: [],
    layout: 'normal',
    cardFaces: null,
    imageUris: null,
    set: 'dev',
    collectorNumber: '1',
  };
}

function build(playerAmount: number) {
  return buildDevTable(playerAmount, { roomManager: new RoomManager(), cardIndex: lookup });
}

describe('buildDevTable', () => {
  it('seats the asked-for number of players, named in seat order', () => {
    const { table, rejoinTokensByName } = build(3);

    expect(table.players.map((p) => p.displayName).sort()).toEqual(['Alice', 'Bob', 'Carol']);
    expect([...rejoinTokensByName.keys()]).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('hands back a table still waiting on its opening hands', () => {
    const { table } = build(4);

    expect(table.setupComplete).toBe(false);
    expect(table.players.some((p) => p.keptHand)).toBe(false);
  });

  it('deals every player an opening hand and leaves the rest in their library', () => {
    const { table } = build(2);

    for (const player of table.players) {
      const mine = Object.values(table.objects).filter((o) => o.ownerId === player.id);
      expect(mine.filter((o) => o.zone.zone === 'hand')).toHaveLength(7);
      expect(mine.filter((o) => o.zone.zone === 'library').length).toBeGreaterThan(0);
      expect(player.commanderIds).toHaveLength(1);
    }
  });

  it('gives each seat a different deck, so the seats are told apart at a glance', () => {
    const { table } = build(4);

    const commanderNames = table.players.map((p) => table.objects[p.commanderIds[0]].source);
    expect(new Set(commanderNames.map((s) => JSON.stringify(s))).size).toBe(4);
  });

  it('gives every seat a rejoin token that the room accepts', () => {
    const { room, rejoinTokensByName } = build(2);

    const result = room.join({ displayName: 'Bob', rejoinToken: rejoinTokensByName.get('Bob')! });
    expect(result.ok).toBe(true);
  });
});

describe('devSeatName', () => {
  it('matches a seat regardless of how the URL was typed', () => {
    expect(devSeatName(4, 'alice')).toBe('Alice');
    expect(devSeatName(4, 'DAVE')).toBe('Dave');
  });

  it('rejects a name that has no seat at this table size', () => {
    expect(devSeatName(2, 'Carol')).toBeUndefined();
    expect(devSeatName(4, 'Eve')).toBeUndefined();
  });
});

describe('the checked-in deck files', () => {
  it('are one per seat', () => {
    expect(devDeckTexts()).toHaveLength(DEV_PLAYER_NAMES.length);
  });

  // A mangled list would otherwise deal a 63-card deck and look like a bug somewhere else.
  it('each hold exactly 100 cards, commander included', () => {
    for (const text of devDeckTexts()) {
      const total = parseDecklist(text).lines.reduce((sum, line) => sum + line.quantity, 0);
      expect(total).toBe(100);
    }
  });

  it('each name exactly one commander', () => {
    for (const text of devDeckTexts()) {
      const commanders = parseDecklist(text).lines.filter((line) => line.section === 'commander');
      expect(commanders).toHaveLength(1);
    }
  });
});
