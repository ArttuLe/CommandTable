// §8.3 player actions (Phase 3). ROLL_DICE/FLIP_COIN/CONCEDE/SAY are deferred to Phase 4 —
// the doc ties their results to the game log, which doesn't exist yet.

import type { Action, PlayerState, TableState } from '@command-table/common';
import { applyCounterUpdate, err, ok, requirePlayer, withObject, type ApplyResult } from './helpers.js';
import { fisherYatesShuffle } from '../shuffle.js';

export function setLife(state: TableState, action: Extract<Action, { t: 'SET_LIFE' }>): ApplyResult {
  for (const playerId of action.playerIds) {
    if (!requirePlayer(state, playerId)) return err(`no such player: ${playerId}`);
  }
  const targets = new Set(action.playerIds);
  const players: PlayerState[] = state.players.map((p) =>
    targets.has(p.id) ? { ...p, life: applyCounterUpdate(p.life, action.update) } : p
  );
  return ok({ ...state, players, revision: state.revision + 1 });
}

export function setPlayerCounter(state: TableState, action: Extract<Action, { t: 'SET_PLAYER_COUNTER' }>): ApplyResult {
  const player = requirePlayer(state, action.playerId);
  if (!player) return err(`no such player: ${action.playerId}`);
  const value = applyCounterUpdate(player.counters[action.key] ?? 0, action.update);
  const players = state.players.map((p) =>
    p.id === action.playerId ? { ...p, counters: { ...p.counters, [action.key]: value } } : p
  );
  return ok({ ...state, players, revision: state.revision + 1 });
}

export function setCommanderDamage(state: TableState, action: Extract<Action, { t: 'SET_COMMANDER_DAMAGE' }>): ApplyResult {
  const player = requirePlayer(state, action.toPlayerId);
  if (!player) return err(`no such player: ${action.toPlayerId}`);
  if (!state.objects[action.fromCommanderObjectId]) {
    return err(`no such object: ${action.fromCommanderObjectId}`);
  }
  const value = applyCounterUpdate(player.commanderDamageTaken[action.fromCommanderObjectId] ?? 0, action.update);
  const players = state.players.map((p) =>
    p.id === action.toPlayerId
      ? { ...p, commanderDamageTaken: { ...p.commanderDamageTaken, [action.fromCommanderObjectId]: value } }
      : p
  );
  return ok({ ...state, players, revision: state.revision + 1 });
}

export function mulligan(
  state: TableState,
  action: Extract<Action, { t: 'MULLIGAN' }>,
  randomInt: (exclusiveMax: number) => number
): ApplyResult {
  if (!requirePlayer(state, action.playerId)) return err(`no such player: ${action.playerId}`);

  const own = (o: TableState['objects'][string]) => 'playerId' in o.zone && o.zone.playerId === action.playerId;

  let next = state;
  const hand = Object.values(next.objects).filter((o) => own(o) && o.zone.zone === 'hand');
  for (const obj of hand) {
    next = withObject(
      next,
      { ...obj, zone: { playerId: action.playerId, zone: 'library' }, position: 0, faceVisibility: { kind: 'none' } },
      false
    );
  }

  const library = Object.values(next.objects).filter((o) => own(o) && o.zone.zone === 'library');
  const shuffled = fisherYatesShuffle(library, randomInt);
  shuffled.forEach((obj, index) => {
    next = withObject(next, { ...obj, position: index, faceVisibility: { kind: 'none' } }, false);
  });

  const toDraw = shuffled.slice(0, 7);
  for (const obj of toDraw) {
    next = withObject(
      next,
      { ...obj, zone: { playerId: action.playerId, zone: 'hand' }, position: 0, faceVisibility: { kind: 'players', ids: [action.playerId] } },
      false
    );
  }

  const players = next.players.map((p) =>
    p.id === action.playerId
      ? // Taking a mulligan un-keeps the hand: the seven you were looking at are back in the
        // library, so whatever you had settled on is no longer a decision about this hand.
        { ...p, keptHand: false, counters: { ...p.counters, mulligan: (p.counters.mulligan ?? 0) + 1 } }
      : p
  );

  return ok({ ...next, players, revision: next.revision + 1 });
}

/** "This hand will do." Says nothing about whether play has begun — that is the host's call. */
export function keepHand(state: TableState, action: Extract<Action, { t: 'KEEP_HAND' }>): ApplyResult {
  if (!requirePlayer(state, action.playerId)) return err(`no such player: ${action.playerId}`);

  return ok({
    ...state,
    players: state.players.map((p) => (p.id === action.playerId ? { ...p, keptHand: true } : p)),
    revision: state.revision + 1,
  });
}

/**
 * Ends the opening-hand step and starts turn 1.
 *
 * Deliberately not conditional on everyone having kept (§1.1, "never block a legal play"): a
 * player who has wandered off shouldn't be able to hold the table hostage, and the client warns
 * the host rather than disabling the button.
 */
export function beginPlay(state: TableState): ApplyResult {
  return ok({ ...state, setupComplete: true, revision: state.revision + 1 });
}
