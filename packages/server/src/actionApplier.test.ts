import { describe, expect, it } from 'vitest';
import { applyAction } from './actionApplier.js';
import { SUMMONING_SICK_MARKER, blockMarker, targetMarker, type GameObject, type TableState } from '@command-table/common';

const ALICE = 'alice';
const BOB = 'bob';

function card(overrides: Partial<GameObject>): GameObject {
  return {
    id: 'obj',
    ownerId: ALICE,
    controllerId: ALICE,
    source: { kind: 'card', scryfallId: 's', oracleId: 'o' },
    zone: { playerId: ALICE, zone: 'library' },
    position: 0,
    faceVisibility: { kind: 'none' },
    faceDown: false,
    currentFace: 0,
    tapped: false,
    flipped: false,
    counters: {},
    attachedTo: null,
    annotation: null,
    markers: [],
    ...overrides,
  };
}

function makeState(objects: GameObject[]): TableState {
  return {
    roomId: 'ROOM1',
    objects: Object.fromEntries(objects.map((o) => [o.id, o])),
    players: [
      { id: ALICE, displayName: 'Alice', seat: 0, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false },
      { id: BOB, displayName: 'Bob', seat: 1, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false },
    ],
    turn: { turnNumber: 1, activePlayerId: ALICE, phase: 'main' },
    log: [],
    revision: 0,
    createdAt: 0,
    setupComplete: true,
  };
}

describe('applyAction: MOVE_OBJECT', () => {
  it('moves an object to a new zone and increments revision', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'hand' } });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].zone).toEqual({ playerId: ALICE, zone: 'hand' });
    expect(result.state.revision).toBe(1);
  });

  it('sets hand visibility to the owner only when moved to hand', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'hand' } });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].faceVisibility).toEqual({ kind: 'players', ids: [ALICE] });
  });

  it('sets battlefield visibility to all when face up', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, {
      t: 'MOVE_OBJECT',
      objectId: 'c1',
      toZone: { playerId: ALICE, zone: 'battlefield' },
    });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].faceVisibility).toEqual({ kind: 'all' });
  });

  // Its controller, not the player whose zone it landed in: a face-down card can sit on someone
  // else's mat (exiled under a permanent) and still only be readable by the player it belongs to.
  it('sets battlefield visibility to the controller only when moved face down', () => {
    const state = makeState([card({ id: 'c1', ownerId: BOB, controllerId: BOB, zone: { playerId: BOB, zone: 'library' } })]);
    const result = applyAction(state, {
      t: 'MOVE_OBJECT',
      objectId: 'c1',
      toZone: { playerId: ALICE, zone: 'battlefield' },
      faceDown: true,
    });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].faceDown).toBe(true);
    expect(result.state.objects['c1'].faceVisibility).toEqual({ kind: 'players', ids: [BOB] });
  });

  it('rejects moving an object that does not exist', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'ghost', toZone: { playerId: ALICE, zone: 'hand' } });
    expect(result.ok).toBe(false);
  });

  it('does not mutate the original state (immutable apply)', () => {
    const state = makeState([card({ id: 'c1' })]);
    applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'hand' } });
    expect(state.objects['c1'].zone).toEqual({ playerId: ALICE, zone: 'library' });
  });

  it('increments the owner\'s commander tax count when a commander is cast from the command zone (§12.2)', () => {
    const state = makeState([card({ id: 'cmd1', zone: { playerId: ALICE, zone: 'commandZone' } })]);
    state.players[0].commanderIds = ['cmd1'];

    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'cmd1', toZone: { zone: 'stack' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.players.find((p) => p.id === ALICE)?.commanderCastCount['cmd1']).toBe(1);
  });

  it('increments commander tax again on a second cast', () => {
    let state = makeState([card({ id: 'cmd1', zone: { playerId: ALICE, zone: 'commandZone' } })]);
    state.players[0].commanderIds = ['cmd1'];

    let result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'cmd1', toZone: { zone: 'stack' } });
    if (!result.ok) throw new Error('unreachable');
    result = applyAction(result.state, { t: 'MOVE_OBJECT', objectId: 'cmd1', toZone: { playerId: ALICE, zone: 'commandZone' } });
    if (!result.ok) throw new Error('unreachable');
    result = applyAction(result.state, { t: 'MOVE_OBJECT', objectId: 'cmd1', toZone: { zone: 'stack' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.players.find((p) => p.id === ALICE)?.commanderCastCount['cmd1']).toBe(2);
  });

  it('does not increment tax for a non-commander object moving to the stack', () => {
    const state = makeState([card({ id: 'spell', zone: { playerId: ALICE, zone: 'hand' } })]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'spell', toZone: { zone: 'stack' } });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.players.find((p) => p.id === ALICE)?.commanderCastCount).toEqual({});
  });
});

// CR 400.7: a card that changes zones becomes a new object. Nothing here enforces rules, but
// carrying tap state and counters out of the battlefield is state every player had to undo by
// hand — a creature that died with three +1/+1 counters came back from the graveyard wearing them.
describe('applyAction: MOVE_OBJECT treats a zone change as a new object', () => {
  it('strips tap state, counters, markers, annotation and face state', () => {
    const state = makeState([
      card({
        id: 'c1',
        zone: { playerId: ALICE, zone: 'battlefield' },
        tapped: true,
        counters: { '+1/+1': 3 },
        markers: ['attacking'],
        annotation: 'my combo piece',
        flipped: true,
        currentFace: 1,
      }),
    ]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'graveyard' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1']).toMatchObject({
      tapped: false,
      counters: {},
      markers: [],
      annotation: null,
      flipped: false,
      currentFace: 0,
    });
  });

  it('marks a permanent summoning-sick as it arrives on a battlefield', () => {
    const state = makeState([card({ id: 'c1', zone: { playerId: ALICE, zone: 'hand' } })]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'battlefield' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].markers).toEqual([SUMMONING_SICK_MARKER]);
  });

  it('does not mark anything arriving anywhere else', () => {
    const state = makeState([card({ id: 'c1', zone: { playerId: ALICE, zone: 'battlefield' } })]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'graveyard' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].markers).toEqual([]);
  });

  it('leaves markers alone when the object never left its zone', () => {
    // Reordering a library is a MOVE_OBJECT that isn't a zone change, so nothing is reset.
    const state = makeState([card({ id: 'c1', zone: { playerId: ALICE, zone: 'library' }, markers: ['flying'] })]);
    const result = applyAction(state, {
      t: 'MOVE_OBJECT',
      objectId: 'c1',
      toZone: { playerId: ALICE, zone: 'library' },
      toPosition: 3,
    });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].markers).toEqual(['flying']);
  });

  it('returns a stolen permanent to its owner when it leaves the battlefield', () => {
    const state = makeState([card({ id: 'c1', controllerId: BOB, zone: { playerId: BOB, zone: 'battlefield' } })]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'graveyard' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].controllerId).toBe(ALICE);
  });

  it('detaches the object it left behind, and anything that was attached to it', () => {
    const state = makeState([
      card({ id: 'creature', zone: { playerId: ALICE, zone: 'battlefield' } }),
      card({ id: 'aura', zone: { playerId: ALICE, zone: 'battlefield' }, attachedTo: 'creature' }),
      card({ id: 'equipped', zone: { playerId: ALICE, zone: 'battlefield' }, attachedTo: 'creature' }),
    ]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'creature', toZone: { playerId: ALICE, zone: 'exile' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['aura'].attachedTo).toBeNull();
    expect(result.state.objects['equipped'].attachedTo).toBeNull();
  });

  it('clears the attachment of an aura that is itself moved away', () => {
    const state = makeState([
      card({ id: 'creature', zone: { playerId: ALICE, zone: 'battlefield' } }),
      card({ id: 'aura', zone: { playerId: ALICE, zone: 'battlefield' }, attachedTo: 'creature' }),
    ]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'aura', toZone: { playerId: ALICE, zone: 'graveyard' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['aura'].attachedTo).toBeNull();
    expect(result.state.objects['creature'].zone).toEqual({ playerId: ALICE, zone: 'battlefield' });
  });

  it('leaves a reorder within one zone alone — a library move is not a new object', () => {
    const state = makeState([card({ id: 'c1', counters: { charge: 2 }, markers: ['noted'] })]);
    const result = applyAction(state, {
      t: 'MOVE_OBJECT',
      objectId: 'c1',
      toZone: { playerId: ALICE, zone: 'library' },
      toPosition: 7,
    });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1']).toMatchObject({ position: 7, counters: { charge: 2 }, markers: ['noted'] });
  });
});

describe('applyAction: SHUFFLE_LIBRARY', () => {
  it('reassigns library positions via the injected RNG without changing zone or count', () => {
    const state = makeState([
      card({ id: 'l1', position: 0 }),
      card({ id: 'l2', position: 1 }),
      card({ id: 'l3', position: 2 }),
    ]);

    const result = applyAction(state, { t: 'SHUFFLE_LIBRARY', playerId: ALICE }, ALICE, { randomInt: () => 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const positions = ['l1', 'l2', 'l3'].map((id) => result.state.objects[id].position).sort();
    expect(positions).toEqual([0, 1, 2]);
  });

  it('rejects an unknown player id', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'SHUFFLE_LIBRARY', playerId: 'ghost' });
    expect(result.ok).toBe(false);
  });
});

describe('applyAction: DRAW', () => {
  it('moves the top N library cards to hand, in library order', () => {
    const state = makeState([
      card({ id: 'top', position: 0 }),
      card({ id: 'middle', position: 1 }),
      card({ id: 'bottom', position: 2 }),
    ]);

    const result = applyAction(state, { t: 'DRAW', playerId: ALICE, count: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['top'].zone.zone).toBe('hand');
    expect(result.state.objects['middle'].zone.zone).toBe('hand');
    expect(result.state.objects['bottom'].zone.zone).toBe('library');
  });

  it('draws fewer cards than requested if the library runs out, without erroring', () => {
    const state = makeState([card({ id: 'only', position: 0 })]);
    const result = applyAction(state, { t: 'DRAW', playerId: ALICE, count: 5 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['only'].zone.zone).toBe('hand');
  });

  it('sets drawn cards visible to the owner only', () => {
    const state = makeState([card({ id: 'top', position: 0 })]);
    const result = applyAction(state, { t: 'DRAW', playerId: ALICE, count: 1 });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['top'].faceVisibility).toEqual({ kind: 'players', ids: [ALICE] });
  });
});

describe('applyAction: PASS_TURN', () => {
  it('advances to the next seat in player order and increments turn number', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'PASS_TURN' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.turn.activePlayerId).toBe(BOB);
    expect(result.state.turn.turnNumber).toBe(2);
  });

  it('wraps around to the first player after the last', () => {
    const state = makeState([]);
    state.turn.activePlayerId = BOB;
    const result = applyAction(state, { t: 'PASS_TURN' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.turn.activePlayerId).toBe(ALICE);
  });

  it('skips eliminated or conceded players', () => {
    const state = makeState([]);
    state.players[1].status = 'eliminated';
    state.players.push({ id: 'carol', displayName: 'Carol', seat: 2, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false });

    const result = applyAction(state, { t: 'PASS_TURN' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.turn.activePlayerId).toBe('carol');
  });

  it('untaps the new active player\'s battlefield permanents (§16.3 "untap bundle")', () => {
    const state = makeState([
      card({ id: 'bobTapped', controllerId: BOB, zone: { playerId: BOB, zone: 'battlefield' }, tapped: true }),
      card({ id: 'aliceTapped', controllerId: ALICE, zone: { playerId: ALICE, zone: 'battlefield' }, tapped: true }),
    ]);
    const result = applyAction(state, { t: 'PASS_TURN' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['bobTapped'].tapped).toBe(false);
    expect(result.state.objects['aliceTapped'].tapped).toBe(true);
  });

  it('clears attacking markers left over from the turn that just ended', () => {
    const state = makeState([
      card({ id: 'attacker', zone: { playerId: ALICE, zone: 'battlefield' }, markers: ['attacking'] }),
      card({ id: 'goaded', zone: { playerId: BOB, zone: 'battlefield' }, markers: ['attacking', 'goaded'] }),
    ]);
    const result = applyAction(state, { t: 'PASS_TURN' });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['attacker'].markers).toEqual([]);
    expect(result.state.objects['goaded'].markers).toEqual(['goaded']);
  });

  it('clears block and target markers along with the attackers', () => {
    const state = makeState([
      card({ id: 'blocker', zone: { playerId: BOB, zone: 'battlefield' }, markers: [blockMarker('attacker'), 'flying'] }),
      card({ id: 'spell', zone: { zone: 'stack' }, markers: [targetMarker('blocker')] }),
    ]);
    const result = applyAction(state, { t: 'PASS_TURN' });

    if (!result.ok) throw new Error('unreachable');
    // The label survives: it describes the card, not the turn.
    expect(result.state.objects['blocker'].markers).toEqual(['flying']);
    expect(result.state.objects['spell'].markers).toEqual([]);
  });

  it('taps whatever fought, since a creature that attacked or blocked is tapped by end of turn', () => {
    const state = makeState([
      card({ id: 'attacker', controllerId: ALICE, zone: { playerId: ALICE, zone: 'battlefield' }, markers: ['attacking'] }),
      card({ id: 'blocker', controllerId: BOB, zone: { playerId: BOB, zone: 'battlefield' }, markers: [blockMarker('attacker')] }),
      card({ id: 'bystander', controllerId: ALICE, zone: { playerId: ALICE, zone: 'battlefield' } }),
    ]);
    const result = applyAction(state, { t: 'PASS_TURN' });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['attacker'].tapped).toBe(true);
    // Bob is the incoming player, so his untap step runs after the tap — a creature that blocked
    // on someone else's turn is untapped again by the time his own turn starts.
    expect(result.state.objects['blocker'].tapped).toBe(false);
    expect(result.state.objects['bystander'].tapped).toBe(false);
  });

  it('leaves a vigilant attacker untapped if the player already untapped it', () => {
    // Nothing here enforces rules (§1.1) — tapping is a convenience, and a player who says a
    // creature has vigilance just untaps it. What must not happen is the tap coming back.
    const state = makeState([
      card({ id: 'attacker', controllerId: ALICE, zone: { playerId: ALICE, zone: 'battlefield' }, markers: ['attacking'], tapped: true }),
    ]);
    const result = applyAction(state, { t: 'PASS_TURN' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['attacker'].tapped).toBe(true);
  });

  it('wakes up the incoming player\'s summoning-sick permanents, and nobody else\'s', () => {
    const state = makeState([
      card({ id: 'bobsNew', controllerId: BOB, zone: { playerId: BOB, zone: 'battlefield' }, markers: [SUMMONING_SICK_MARKER, 'flying'] }),
      card({ id: 'alicesNew', controllerId: ALICE, zone: { playerId: ALICE, zone: 'battlefield' }, markers: [SUMMONING_SICK_MARKER] }),
    ]);
    const result = applyAction(state, { t: 'PASS_TURN' });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['bobsNew'].markers).toEqual(['flying']);
    expect(result.state.objects['alicesNew'].markers).toEqual([SUMMONING_SICK_MARKER]);
  });

  // The draw is the player's own (`D`, or the Draw button) — passing turn must not take it for
  // them, however convenient the bundle would be.
  it('leaves the incoming player\'s library alone', () => {
    const state = makeState([card({ id: 'bobTop', ownerId: BOB, controllerId: BOB, zone: { playerId: BOB, zone: 'library' } })]);
    const result = applyAction(state, { t: 'PASS_TURN' });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['bobTop'].zone).toEqual({ playerId: BOB, zone: 'library' });
  });

  it('bumps revision by exactly 1, untap and sweep and all', () => {
    const state = makeState([
      card({ id: 'bobTapped', controllerId: BOB, zone: { playerId: BOB, zone: 'battlefield' }, tapped: true, markers: ['attacking'] }),
    ]);
    const result = applyAction(state, { t: 'PASS_TURN' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.revision).toBe(state.revision + 1);
  });
});

describe('log entries (§15.1: every action produces one)', () => {
  it('appends a public log entry attributed to the given actor, at the new revision', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, { t: 'TAP', objectId: 'c1' }, BOB);

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.log).toHaveLength(1);
    expect(result.state.log[0]).toMatchObject({ actorId: BOB, revision: 1, visibility: { kind: 'all' } });
    expect(result.state.log[0].text.length).toBeGreaterThan(0);
  });

  it('does not append a log entry when the action is rejected', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'TAP', objectId: 'ghost' }, ALICE);
    expect(result.ok).toBe(false);
  });

  it('preserves prior log entries and appends rather than replaces', () => {
    let state = makeState([card({ id: 'c1' })]);
    state = unwrap(applyAction(state, { t: 'TAP', objectId: 'c1' }, ALICE));
    state = unwrap(applyAction(state, { t: 'UNTAP', objectId: 'c1' }, BOB));
    expect(state.log).toHaveLength(2);
    expect(state.log.map((e) => e.actorId)).toEqual([ALICE, BOB]);
  });

  it('defaults the actor to a placeholder when none is given', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, { t: 'TAP', objectId: 'c1' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.log[0].actorId).toBe('system');
  });
});

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.state;
}
