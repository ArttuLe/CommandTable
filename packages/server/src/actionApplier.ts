// Applies an Action to a TableState, per design doc §3 ("the server validates only structural
// legality... never rules legality") and §8. Pure and immutable: returns a new state rather
// than mutating the one it's given, which keeps undo (§15.2, later) a matter of swapping
// snapshots. Dispatches to per-§8-subsection modules in ./actions/; MOVE_OBJECT/SHUFFLE_LIBRARY/
// DRAW/PASS_TURN (Phase 2) stay here since they predate that split.

import { randomInt as cryptoRandomInt } from 'node:crypto';
import { ATTACKING_MARKER, type Action, type GameObject, type LogEntry, type PlayerId, type TableState } from '@command-table/common';
import { fisherYatesShuffle } from './shuffle.js';
import {
  asNewObject,
  bumpRevision,
  defaultVisibilityFor,
  detachFrom,
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

// Public entry point: applies the action, then appends a LogEntry describing it (§15.1 — every
// action produces one). `actorId` only affects the log; structural validation doesn't care who's
// acting (§10: "anyone can take any action at any time"). Defaults to a placeholder so tests
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

  const { text, visibility, kind } = result.log ?? { text: describeAction(action), visibility: undefined, kind: undefined };
  const entry: LogEntry = {
    revision: result.state.revision,
    timestamp: Date.now(),
    actorId,
    text,
    visibility: visibility ?? { kind: 'all' },
    undoable: true,
    kind,
  };
  return { ok: true, state: { ...result.state, log: [...result.state.log, entry] } };
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
    case 'CLEAR_ALL_MARKERS':
      return objectActions.clearAllMarkers(state);
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

  const faceDown = action.faceDown ?? existing.faceDown;
  // A change of zone makes this a new object (CR 400.7, see asNewObject); staying put — a
  // library reorder — does not. Visibility is decided by the destination either way.
  const changedZone = !zonesEqual(existing.zone, action.toZone);
  const base = changedZone ? asNewObject(existing) : existing;
  const updated: GameObject = {
    ...base,
    zone: action.toZone,
    position: action.toPosition ?? 0,
    faceDown,
    faceVisibility: defaultVisibilityFor(action.toZone, base.controllerId, faceDown),
  };

  const next = withObject(changedZone ? detachFrom(state, existing.id) : state, updated);
  const isCommanderCast = existing.zone.zone === 'commandZone' && !('playerId' in action.toZone) && action.toZone.zone === 'stack';
  if (!isCommanderCast) {
    return ok(next);
  }

  // §12.2: commander tax is a display hint, incremented here so the client doesn't have to
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

  // Drawing from an empty library takes what's there rather than erroring: §3 leaves losing the
  // game to the players.
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

  // §16.3 "pass turn (with untap bundle)": the new active player's permanents untap as part of
  // passing turn, rather than needing a separate UNTAP_ALL click, and the combat markers from
  // the turn that just ended are swept up in the same beat.
  //
  // Drawing for the turn is deliberately NOT bundled here: it's the one turn-start step players
  // want to take themselves (`D`, or the Draw button), and a draw that happens to you is worse
  // than one you asked for.
  const swept = objectActions.clearMarkerFromAll(state, ATTACKING_MARKER);
  const untapped = objectActions.untapControlledBy(swept, nextPlayerId);

  return ok(
    bumpRevision({
      ...untapped,
      turn: { ...untapped.turn, activePlayerId: nextPlayerId, turnNumber: untapped.turn.turnNumber + 1 },
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
