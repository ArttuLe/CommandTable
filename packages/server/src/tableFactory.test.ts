import { describe, expect, it } from 'vitest';
import { createTableState, type SeatSetup } from './tableFactory.js';
import { SYSTEM_ACTOR, type Card, type ResolvedDecklist } from '@command-table/common';

function makeCard(name: string, overrides: Partial<Card> = {}): Card {
  return {
    oracleId: `oracle-${name}`,
    scryfallId: `scryfall-${name}`,
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
    set: 'set',
    collectorNumber: '1',
    ...overrides,
  };
}

function makeResolved(commanderName: string, deckLines: Array<[string, number]>): ResolvedDecklist {
  return {
    commanders: [
      {
        line: { quantity: 1, name: commanderName, set: null, collectorNumber: null, section: 'commander' },
        card: makeCard(commanderName),
      },
    ],
    deck: deckLines.map(([name, quantity]) => ({
      line: { quantity, name, set: null, collectorNumber: null, section: 'deck' },
      card: makeCard(name),
    })),
    sideboard: [],
    maybeboard: [],
    unresolved: [],
    warnings: [],
  };
}

const seats: SeatSetup[] = [
  { playerId: 'alice', displayName: 'Alice', seat: 0, resolved: makeResolved('Atraxa', [['Sol Ring', 1], ['Plains', 3]]) },
  { playerId: 'bob', displayName: 'Bob', seat: 1, resolved: makeResolved('Korvold', [['Forest', 2]]) },
];

describe('createTableState', () => {
  it('puts each commander in its owner\'s command zone', () => {
    const state = createTableState({ roomId: 'ROOM1', seats }, { randomInt: () => 0 });

    const aliceCommander = Object.values(state.objects).find(
      (o) => o.ownerId === 'alice' && o.zone.zone === 'commandZone'
    );
    expect(aliceCommander).toBeDefined();
    expect(aliceCommander?.source).toEqual({ kind: 'card', scryfallId: 'scryfall-Atraxa', oracleId: 'oracle-Atraxa' });
  });

  it('creates one library object per copy, expanding line quantity, minus the opening hand', () => {
    const state = createTableState({ roomId: 'ROOM1', seats }, { randomInt: () => 0 });

    const aliceLibrary = Object.values(state.objects).filter(
      (o) => o.ownerId === 'alice' && o.zone.zone === 'library'
    );
    // 1 Sol Ring + 3 Plains = 4 cards, all dealt into the opening hand (deck smaller than 7)
    expect(aliceLibrary).toHaveLength(0);
  });

  it('deals each player an opening hand of 7, visible only to them', () => {
    const bigDeck = makeResolved('Atraxa', Array.from({ length: 20 }, (_, i) => [`Card ${i}`, 1] as [string, number]));
    const state = createTableState(
      { roomId: 'ROOM1', seats: [{ playerId: 'alice', displayName: 'Alice', seat: 0, resolved: bigDeck }] },
      { randomInt: () => 0 }
    );

    const aliceHand = Object.values(state.objects).filter((o) => o.ownerId === 'alice' && o.zone.zone === 'hand');
    expect(aliceHand).toHaveLength(7);
    for (const obj of aliceHand) {
      expect(obj.faceVisibility).toEqual({ kind: 'players', ids: ['alice'] });
    }
    const aliceLibrary = Object.values(state.objects).filter((o) => o.ownerId === 'alice' && o.zone.zone === 'library');
    expect(aliceLibrary).toHaveLength(13);
  });

  it('deals whatever is available, not an error, when the deck has fewer than 7 cards', () => {
    const state = createTableState({ roomId: 'ROOM1', seats }, { randomInt: () => 0 });
    const aliceHand = Object.values(state.objects).filter((o) => o.ownerId === 'alice' && o.zone.zone === 'hand');
    expect(aliceHand).toHaveLength(4);
  });

  it('sets library cards to hidden visibility', () => {
    // Needs a deck bigger than the opening hand, or there's no library card left to check.
    const bigDeck = makeResolved('Atraxa', Array.from({ length: 20 }, (_, i) => [`Card ${i}`, 1] as [string, number]));
    const state = createTableState(
      { roomId: 'ROOM1', seats: [{ playerId: 'alice', displayName: 'Alice', seat: 0, resolved: bigDeck }] },
      { randomInt: () => 0 }
    );
    const libraryCard = Object.values(state.objects).find((o) => o.zone.zone === 'library');
    expect(libraryCard?.faceVisibility).toEqual({ kind: 'none' });
  });

  it('sets commanders and battlefield-visible zones to visible-to-all', () => {
    const state = createTableState({ roomId: 'ROOM1', seats }, { randomInt: () => 0 });
    const commander = Object.values(state.objects).find((o) => o.zone.zone === 'commandZone');
    expect(commander?.faceVisibility).toEqual({ kind: 'all' });
  });

  it('initializes players at 40 life with their commander recorded', () => {
    const state = createTableState({ roomId: 'ROOM1', seats }, { randomInt: () => 0 });
    const alice = state.players.find((p) => p.id === 'alice');
    expect(alice?.life).toBe(40);
    expect(alice?.commanderIds).toHaveLength(1);
    expect(alice?.status).toBe('active');
  });

  it('does not bring sideboard or maybeboard cards to the table', () => {
    const withExtras: SeatSetup[] = [
      {
        playerId: 'alice',
        displayName: 'Alice',
        seat: 0,
        resolved: {
          ...makeResolved('Atraxa', [['Sol Ring', 1]]),
          sideboard: [{ line: { quantity: 1, name: 'Extra', set: null, collectorNumber: null, section: 'sideboard' }, card: makeCard('Extra') }],
          maybeboard: [{ line: { quantity: 1, name: 'Maybe', set: null, collectorNumber: null, section: 'maybeboard' }, card: makeCard('Maybe') }],
        },
      },
    ];

    const state = createTableState({ roomId: 'ROOM1', seats: withExtras }, { randomInt: () => 0 });

    const names = Object.values(state.objects).map((o) => (o.source.kind === 'card' ? o.source.scryfallId : ''));
    expect(names).not.toContain('scryfall-Extra');
    expect(names).not.toContain('scryfall-Maybe');
  });

  it('randomizes turn order using the injected randomInt', () => {
    const state = createTableState({ roomId: 'ROOM1', seats }, { randomInt: () => 1 });
    // With a 2-seat array, randomInt(2)=1 at i=1 swaps index 1 with itself: order unchanged.
    expect(state.players.map((p) => p.id)).toEqual(['alice', 'bob']);
    expect(state.turn.activePlayerId).toBe(state.players[0].id);
  });

  it('opens the log by saying the setup happened, since none of it is observable', () => {
    const state = createTableState({ roomId: 'ROOM1', seats }, { randomInt: () => 0 });
    expect(state.log).toHaveLength(1);
    expect(state.log[0].actorId).toBe(SYSTEM_ACTOR);
    expect(state.log[0].text).toContain('shuffled every library');
    expect(state.log[0].visibility).toEqual({ kind: 'all' });
    // Nothing to rewind to: it describes the table's own construction, not a player's move.
    expect(state.log[0].undoable).toBe(false);
  });

  it('starts at revision 0 with turn number 1', () => {
    const state = createTableState({ roomId: 'ROOM1', seats }, { randomInt: () => 0 });
    expect(state.revision).toBe(0);
    expect(state.turn.turnNumber).toBe(1);
  });
});
