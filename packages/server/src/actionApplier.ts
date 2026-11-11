// Applies an Action to a TableState, validating only structural legality, never rules legality.
// Pure and immutable: returns a new state rather than mutating the one it's given, which keeps
// undo a matter of swapping snapshots. Dispatches to per-category modules in ./actions/;
// MOVE_OBJECT/SHUFFLE_LIBRARY/DRAW/PASS_TURN stay here since they predate that split.

import { randomInt as cryptoRandomInt } from 'node:crypto';
import {
  SUMMONING_SICK_MARKER,
  isCombatMarker,
  type Action,
  type GameObject,
  type LogEntry,
  type PlayerId,
  type TableState,
} from '@command-table/common';
import { fisherYatesShuffle } from './shuffle.js';
import {
  asNewObject,
  placeInLibrary,
  rekeyIfHidden,
  bumpRevision,
  defaultVisibilityFor,
  detachFrom,
  markersOnArrival,
  err,
  ok,
  requireObject,
  requirePlayer,
  withObject,
  zonesEqual,
  type ApplyResult,
} from './actions/helpers.js';
import * as objectActions from './actions/objectActions.js';
import * as zoneActions from './actions/zoneActions.js';
import * as playerActions from './actions/playerActions.js';
import * as metaActions from './actions/metaActions.js';
import { describeAction } from './actionDescriptions.js';

export type { ApplyResult } from './actions/helpers.js';

interface ApplyDeps {
  randomInt: (exclusiveMax: number) => number;
}

const defaultDeps: ApplyDeps = { randomInt: cryptoRandomInt };

// Public entry point: applies the action, then appends a LogEntry describing it (every
// action produces one). `actorId` only affects the log; structural validation doesn't care who's
// acting (anyone can take any action at any time). Defaults to a placeholder so tests
// that don't care about log authorship don't need to supply one — server.ts always passes the
// real connection's playerId.
export function applyAction(
  state: TableState,
  action: Action,
  actorId: PlayerId = 'system',
  deps: ApplyDeps = defaultDeps
): ApplyResult {
  const result = dispatch(state, action, deps);
  if (!result.ok) {
    return result;
  }
  // An action that changed nothing (a marker the card already has, a bulk move into the zone the
  // cards are already in) hands back the table it was given, unlogged. Logged, it reused the
  // current revision, and the history then held two snapshots under one number — enough for an
  // undo after a revert to bring back what had just been undone. server.ts records nothing for it.
  if (result.state.revision === state.revision && !result.log) {
    return { ok: true, state };
  }

  const { text, visibility, kind } = result.log ?? { text: describeAction(action, state, result.state, actorId), visibility: undefined, kind: undefined };
  const subject = subjectOf(state, result.state, action);
  const entry: LogEntry = {
    revision: result.state.revision,
    timestamp: Date.now(),
    actorId,
    text,
    visibility: visibility ?? { kind: 'all' },
    undoable: true,
    kind,
    ...(subject ? { subject } : {}),
  };
  return { ok: true, state: { ...result.state, log: [...result.state.log, entry] } };
}

/**
 * What the log line is about, if everyone could see it before or after the action (the log
 * is the referee, and "tapped a permanent" referees nothing). A reference, not a name: the action
 * layer has no card data by design, so the client resolves it. Anything someone couldn't see —
 * a card drawn, a morph played face down — stays "a card".
 */
function subjectOf(before: TableState, after: TableState, action: Action): LogEntry['subject'] {
  const objectId = 'objectId' in action ? action.objectId : action.t === 'SET_COMMANDER_DAMAGE' ? action.fromCommanderObjectId : null;
  if (!objectId) return undefined;
  const was = before.objects[objectId];
  const now = after.objects[objectId];
  if (was?.faceVisibility.kind !== 'all' && now?.faceVisibility.kind !== 'all') return undefined;
  const source = (was ?? now)!.source;
  if ('scryfallId' in source && source.scryfallId) return { scryfallId: source.scryfallId };
  if (source.kind === 'token' && source.adhoc) return { name: source.adhoc.name };
  return undefined;
}

function dispatch(state: TableState, action: Action, deps: ApplyDeps): ApplyResult {
  switch (action.t) {
    case 'MOVE_OBJECT':
      return moveObject(state, action);
    case 'SHUFFLE_LIBRARY':
      return shuffleLibrary(state, action, deps);
    case 'DRAW':
      return draw(state, action);
    case 'PASS_TURN':
      return passTurn(state);

    case 'TAP':
      return objectActions.tap(state, action);
    case 'UNTAP':
      return objectActions.untap(state, action);
    case 'UNTAP_ALL':
      return objectActions.untapAll(state, action);
    case 'SET_COUNTER':
      return objectActions.setCounter(state, action);
    case 'ATTACH':
      return objectActions.attach(state, action);
    case 'UNATTACH':
      return objectActions.unattach(state, action);
    case 'SET_MARKER':
      return objectActions.setMarker(state, action);
    case 'CLEAR_MARKER':
      return objectActions.clearMarker(state, action);
    case 'CLEAR_MARKERS_AND_COUNTERS':
      return objectActions.clearMarkersAndCounters(state);
    case 'TRANSFORM':
      return objectActions.transform(state, action);
    case 'TURN_FACE_DOWN':
      return objectActions.turnFaceDown(state, action);
    case 'TURN_FACE_UP':
      return objectActions.turnFaceUp(state, action);
    case 'SET_ANNOTATION':
      return objectActions.setAnnotation(state, action);
    case 'CHANGE_CONTROLLER':
      return objectActions.changeController(state, action);
    case 'CREATE_TOKEN':
      return objectActions.createToken(state, action);
    case 'CREATE_COPY':
      return objectActions.createCopy(state, action);
    case 'DELETE_OBJECT':
      return objectActions.deleteObject(state, action);

    case 'MILL':
      return zoneActions.mill(state, action);
    case 'PEEK_TOP':
      return zoneActions.peekTop(state, action);
    case 'REVEAL':
      return zoneActions.reveal(state, action);
    case 'HIDE':
      return zoneActions.hide(state, action);
    case 'SEARCH_LIBRARY':
      return zoneActions.searchLibrary(state, action);
    case 'MOVE_ALL':
      return zoneActions.moveAll(state, action);

    case 'SET_LIFE':
      return playerActions.setLife(state, action);
    case 'SET_PLAYER_COUNTER':
      return playerActions.setPlayerCounter(state, action);
    case 'SET_COMMANDER_DAMAGE':
      return playerActions.setCommanderDamage(state, action);
    case 'MULLIGAN':
      return playerActions.mulligan(state, action, deps.randomInt);
    case 'KEEP_HAND':
      return playerActions.keepHand(state, action);
    case 'BEGIN_PLAY':
      return playerActions.beginPlay(state);

    case 'ROLL_DICE':
      return metaActions.rollDice(state, action, deps.randomInt);
    case 'FLIP_COIN':
      return metaActions.flipCoin(state, action, deps.randomInt);
    case 'CONCEDE':
      return metaActions.concede(state, action);
    case 'SAY':
      return metaActions.say(state, action);
  }
}

function moveObject(state: TableState, action: Extract<Action, { t: 'MOVE_OBJECT' }>): ApplyResult {
  const existing = requireObject(state, action.objectId);
  if (!existing) {
    return err(`no such object: ${action.objectId}`);
  }

  // A change of zone makes this a new object (CR 400.7, see asNewObject); staying put — a
  // library reorder — does not. Visibility is decided by the destination either way.
  const changedZone = !zonesEqual(existing.zone, action.toZone);
  const base = changedZone ? asNewObject(existing) : existing;
  // Read off the new object, which is face up: only a move that asks keeps a card face down.
  const faceDown = action.faceDown ?? base.faceDown;
  const updated: GameObject = {
    ...base,
    zone: action.toZone,
    position: action.toPosition ?? 0,
    faceDown,
    faceVisibility: defaultVisibilityFor(action.toZone, base.controllerId, faceDown),
    // Arriving on a battlefield earns a summoning-sickness marker; a library reorder isn't an
    // arrival at all and keeps whatever the object already had.
    markers: changedZone ? markersOnArrival(action.toZone) : base.markers,
  };

  const placed = withObject(changedZone ? detachFrom(state, existing.id) : state, updated);
  const ordered = action.toZone.zone === 'library' ? placeInLibrary(placed, existing.id, action.toPosition ?? 0) : placed;
  const next = rekeyIfHidden(ordered, existing, existing.id);
  const isCommanderCast = existing.zone.zone === 'commandZone' && !('playerId' in action.toZone) && action.toZone.zone === 'stack';
  if (!isCommanderCast) {
    return ok(next);
  }

  // Commander tax is a display hint, incremented here so the client doesn't have to
  // infer "was that a commander cast" itself; the player still pays the tax themselves.
  return ok({
    ...next,
    players: next.players.map((p) =>
      p.commanderIds.includes(existing.id)
        ? { ...p, commanderCastCount: { ...p.commanderCastCount, [existing.id]: (p.commanderCastCount[existing.id] ?? 0) + 1 } }
        : p
    ),
  });
}

function shuffleLibrary(state: TableState, action: Extract<Action, { t: 'SHUFFLE_LIBRARY' }>, deps: ApplyDeps): ApplyResult {
  if (!requirePlayer(state, action.playerId)) {
    return err(`no such player: ${action.playerId}`);
  }

  const libraryObjects = Object.values(state.objects).filter(
    (o) => 'playerId' in o.zone && o.zone.playerId === action.playerId && o.zone.zone === 'library'
  );
  const shuffled = fisherYatesShuffle(libraryObjects, deps.randomInt);

  let next = state;
  shuffled.forEach((obj, index) => {
    // Also re-hides anything left visible by a prior SEARCH_LIBRARY/PEEK_TOP — a shuffle
    // scrambles the very order that made those peeks meaningful.
    next = withObject(next, { ...obj, position: index, faceVisibility: { kind: 'none' } }, false);
  });

  return ok(bumpRevision(next));
}

function draw(state: TableState, action: Extract<Action, { t: 'DRAW' }>): ApplyResult {
  if (!requirePlayer(state, action.playerId)) {
    return err(`no such player: ${action.playerId}`);
  }

  const { playerId } = action;
  const library = Object.values(state.objects)
    .filter((o) => 'playerId' in o.zone && o.zone.playerId === playerId && o.zone.zone === 'library')
    .sort((a, b) => a.position - b.position);

  // Drawing from an empty library takes what's there rather than erroring: the server leaves
  // losing the game to the players.
  let next = state;
  for (const obj of library.slice(0, action.count)) {
    next = withObject(
      next,
      {
        ...obj,
        zone: { playerId, zone: 'hand' },
        position: 0,
        faceVisibility: { kind: 'players', ids: [playerId] },
      },
      false
    );
  }

  return ok(bumpRevision(next));
}

function passTurn(state: TableState): ApplyResult {
  const order = state.players;
  const currentIndex = order.findIndex((p) => p.id === state.turn.activePlayerId);
  const nextIndex = findNextActiveIndex(order, currentIndex);
  const nextPlayerId = order[nextIndex].id;

  // Pass turn with untap bundle: the new active player's permanents untap as part of
  // passing turn, rather than needing a separate UNTAP_ALL click, and the combat markers from
  // the turn that just ended are swept up in the same beat.
  //
  // Drawing for the turn is deliberately NOT bundled here: it's the one turn-start step players
  // want to take themselves (`D`, or the Draw button), and a draw that happens to you is worse
  // than one you asked for.
  // Order matters here, and each step undoes part of the one before it on purpose:
  //
  // 1. tap what fought — read *before* the sweep, since the sweep is what erases the evidence;
  // 2. sweep the combat markers, which belong to the turn that just ended;
  // 3. untap the incoming player, which correctly un-taps their own blockers from step 1 — a
  //    creature that blocked on someone else's turn is ready again by the time its own comes;
  // 4. wake the incoming player's summoning-sick permanents, for the same reason.
  const tapped = objectActions.tapCombatants(state);
  const swept = objectActions.clearMarkersFromAll(tapped, isCombatMarker);
  const untapped = objectActions.untapControlledBy(swept, nextPlayerId);
  const woken = objectActions.clearMarkerFromControlledBy(untapped, nextPlayerId, SUMMONING_SICK_MARKER);

  return ok(
    bumpRevision({
      ...woken,
      turn: { ...woken.turn, activePlayerId: nextPlayerId, turnNumber: woken.turn.turnNumber + 1 },
    })
  );
}

function findNextActiveIndex(order: TableState['players'], fromIndex: number): number {
  for (let step = 1; step <= order.length; step++) {
    const candidate = (fromIndex + step) % order.length;
    if (order[candidate].status === 'active') {
      return candidate;
    }
  }
  return fromIndex;
}
